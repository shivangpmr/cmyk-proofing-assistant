import sharp from "sharp";
import {
  severityFromDeltaE,
  type AnalysisResult,
  type AnalyzedColor,
  type AnalysisSummary,
  type ImageMeta,
  type PrintReadiness,
  type ProfileId,
  type ProfileInfo,
  type RgbColor,
} from "@cmyk/shared";
import { clusterColors } from "./clustering.js";
import {
  deltaE00,
  rgbToHex,
  rgbToHsl,
  rgbToLab,
  hexToRgb,
} from "./colorMath.js";
import { exportCmykTiff, softProofImageBuffer, softProofSample } from "./convert.js";
import { explainShift } from "./explanations.js";
import { nameColor } from "./naming.js";
import { listProfiles, resolveProfile } from "./profiles.js";
import { suggestAlternatives as generateSuggestions } from "./suggestions.js";

export const colorEngine = {
  listProfiles,
  resolveProfile,

  async convertRGBToCMYK(rgb: RgbColor, profileId: ProfileId | string) {
    const profile = resolveProfile(profileId);
    const sample = await softProofSample(rgb, profile);
    return { profile, ...sample };
  },

  async softProofRGB(rgb: RgbColor, profileId: ProfileId | string) {
    const profile = resolveProfile(profileId);
    return softProofSample(rgb, profile);
  },

  async softProofImage(input: Buffer, profileId: ProfileId | string, maxDimension = 1600) {
    const profile = resolveProfile(profileId);
    const proof = await softProofImageBuffer(input, profile, maxDimension);
    return { profile, ...proof };
  },

  async suggestAlternatives(rgb: RgbColor, profileId: ProfileId | string) {
    const profile = resolveProfile(profileId);
    const suggestions = await generateSuggestions(rgb, profile);
    return { profile, suggestions };
  },

  async exportCmykTiff(input: Buffer, profileId: ProfileId | string) {
    const profile = resolveProfile(profileId);
    const buffer = await exportCmykTiff(input, profile);
    return { profile, buffer };
  },

  async getImageMeta(input: Buffer, filename: string): Promise<ImageMeta> {
    const meta = await sharp(input).metadata();
    return {
      filename,
      width: meta.width ?? 0,
      height: meta.height ?? 0,
      format: meta.format ?? "unknown",
      colorMode: meta.space ?? (meta.hasProfile ? "Tagged" : "sRGB (assumed)"),
    };
  },

  async analyzeImage(
    input: Buffer,
    profileId: ProfileId | string,
    options?: { maxColors?: number; includeSuggestions?: boolean },
  ): Promise<AnalysisResult> {
    const profile = resolveProfile(profileId);
    const maxColors = options?.maxColors ?? 12;
    const includeSuggestions = options?.includeSuggestions ?? true;

    const working = await sharp(input)
      .rotate()
      .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const clusters = clusterColors(
      working.data,
      working.info.width,
      working.info.height,
      working.info.channels,
      maxColors,
    );

    const colors: AnalyzedColor[] = [];
    let usedApproximate = profile.approximate;

    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i]!;
      const sample = await softProofSample(cluster.rgb, profile);
      usedApproximate = usedApproximate || sample.usedApproximate;
      const lab = rgbToLab(cluster.rgb);
      const proofLab = rgbToLab(sample.softProofRgb);
      const deltaE = deltaE00(lab, proofLab);
      const severity = severityFromDeltaE(deltaE);
      const suggestions =
        includeSuggestions && severity !== "safe"
          ? await generateSuggestions(cluster.rgb, profile)
          : [];

      colors.push({
        id: `c${i + 1}`,
        rgb: cluster.rgb,
        hex: cluster.hex,
        hsl: rgbToHsl(cluster.rgb),
        lab,
        softProofRgb: sample.softProofRgb,
        softProofHex: sample.softProofHex,
        cmyk: sample.cmyk,
        deltaE,
        severity,
        gamutStatus: severity === "safe" ? "within" : "outside",
        explanation: explainShift(cluster.rgb, sample.softProofRgb, deltaE),
        weight: cluster.weight,
        name: nameColor(cluster.rgb, lab),
        suggestions,
      });
    }

    const summary = buildSummary(colors);

    return {
      profile,
      summary,
      colors,
      analysisWidth: working.info.width,
      analysisHeight: working.info.height,
      usedApproximate,
    };
  },

  async analyzeHexColors(hexes: string[], profileId: ProfileId | string): Promise<AnalysisResult> {
    const profile = resolveProfile(profileId);
    const colors: AnalyzedColor[] = [];
    let usedApproximate = profile.approximate;

    for (let i = 0; i < hexes.length; i++) {
      const rgb = hexToRgb(hexes[i]!);
      const sample = await softProofSample(rgb, profile);
      usedApproximate = usedApproximate || sample.usedApproximate;
      const lab = rgbToLab(rgb);
      const deltaE = deltaE00(lab, rgbToLab(sample.softProofRgb));
      const severity = severityFromDeltaE(deltaE);
      const suggestions =
        severity !== "safe" ? await generateSuggestions(rgb, profile) : [];

      colors.push({
        id: `seed-${i + 1}`,
        rgb,
        hex: rgbToHex(rgb),
        hsl: rgbToHsl(rgb),
        lab,
        softProofRgb: sample.softProofRgb,
        softProofHex: sample.softProofHex,
        cmyk: sample.cmyk,
        deltaE,
        severity,
        gamutStatus: severity === "safe" ? "within" : "outside",
        explanation: explainShift(rgb, sample.softProofRgb, deltaE),
        weight: 1,
        name: nameColor(rgb, lab),
        suggestions,
      });
    }

    return {
      profile,
      summary: buildSummary(colors),
      colors,
      analysisWidth: 0,
      analysisHeight: 0,
      usedApproximate,
    };
  },
};

function buildSummary(colors: AnalyzedColor[]): AnalysisSummary {
  const safeCount = colors.filter((c) => c.severity === "safe").length;
  const minorCount = colors.filter((c) => c.severity === "minor").length;
  const significantCount = colors.filter((c) => c.severity === "significant").length;

  let readiness: PrintReadiness = "ready";
  if (significantCount > 0) readiness = "needs_attention";
  else if (minorCount > 0) readiness = "review";

  const mostAffected = colors
    .filter((c) => c.severity !== "safe")
    .sort((a, b) => b.deltaE - a.deltaE)
    .slice(0, 3)
    .map((c) => c.name);

  let overview = "No significant color shifts detected in this soft proof.";
  if (readiness === "needs_attention") {
    overview = `The design contains ${significantCount} highly saturated RGB color${significantCount === 1 ? "" : "s"} that may reproduce noticeably differently in CMYK.`;
  } else if (readiness === "review") {
    overview = `${minorCount} color${minorCount === 1 ? "" : "s"} may shift slightly under the selected CMYK profile.`;
  }

  return {
    readiness,
    analyzedCount: colors.length,
    safeCount,
    minorCount,
    significantCount,
    mostAffected,
    overview,
  };
}

export type { ProfileInfo };
