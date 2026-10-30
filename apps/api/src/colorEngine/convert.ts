import sharp from "sharp";
import type { CmykColor, ProfileInfo, RgbColor } from "@cmyk/shared";
import {
  approximateSoftProofRgb,
  cmykBytesToPercent,
  clampByte,
  rgbToCmykDisplay,
  rgbToHex,
} from "./colorMath.js";
import { profileIccPath } from "./profiles.js";

export interface SoftProofSample {
  softProofRgb: RgbColor;
  softProofHex: string;
  cmyk: CmykColor;
  usedApproximate: boolean;
}

const sampleCache = new Map<string, SoftProofSample>();
const SAMPLE_CACHE_LIMIT = 50_000;

/**
 * sRGB pixels → CMYK (ICC) → sRGB soft proof.
 * CMYK must travel inside a TIFF with the profile embedded: raw 4-channel
 * buffers are read back by Sharp as RGBA, not CMYK.
 */
async function iccRoundTrip(
  rgb: Buffer,
  width: number,
  height: number,
  iccPath: string,
): Promise<{ cmyk: Buffer; proof: Buffer; proofChannels: number }> {
  const input = () => sharp(rgb, { raw: { width, height, channels: 3 } });

  const [cmyk, tiff] = await Promise.all([
    input().withIccProfile(iccPath).toColorspace("cmyk").raw().toBuffer(),
    input().withIccProfile(iccPath).toColorspace("cmyk").tiff().toBuffer(),
  ]);

  const proof = await sharp(tiff)
    .toColorspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });

  return { cmyk, proof: proof.data, proofChannels: proof.info.channels };
}

export async function softProofBatch(
  colors: RgbColor[],
  profile: ProfileInfo,
): Promise<SoftProofSample[]> {
  const icc = profileIccPath(profile);
  const useIcc = Boolean(icc && !profile.approximate);
  const cacheKey = (c: RgbColor) => `${useIcc ? icc : "approx"}|${rgbToHex(c)}`;

  const results: (SoftProofSample | undefined)[] = colors.map((c) =>
    sampleCache.get(cacheKey(c)),
  );
  const missing = colors
    .map((c, i) => ({ c, i }))
    .filter(({ i }) => !results[i]);

  if (missing.length > 0) {
    let computed: SoftProofSample[] | null = null;

    if (useIcc && icc) {
      try {
        const raw = Buffer.from(
          missing.flatMap(({ c }) => [clampByte(c.r), clampByte(c.g), clampByte(c.b)]),
        );
        const { cmyk, proof, proofChannels } = await iccRoundTrip(raw, missing.length, 1, icc);
        computed = missing.map((_, j) => {
          const softProofRgb: RgbColor = {
            r: proof[j * proofChannels]!,
            g: proof[j * proofChannels + 1]!,
            b: proof[j * proofChannels + 2]!,
          };
          return {
            softProofRgb,
            softProofHex: rgbToHex(softProofRgb),
            cmyk: cmykBytesToPercent(cmyk[j * 4]!, cmyk[j * 4 + 1]!, cmyk[j * 4 + 2]!, cmyk[j * 4 + 3]!),
            usedApproximate: false,
          };
        });
      } catch {
        computed = null;
      }
    }

    if (!computed) {
      computed = missing.map(({ c }) => {
        const softProofRgb = approximateSoftProofRgb(c);
        return {
          softProofRgb,
          softProofHex: rgbToHex(softProofRgb),
          cmyk: rgbToCmykDisplay(softProofRgb),
          usedApproximate: true,
        };
      });
    }

    if (sampleCache.size > SAMPLE_CACHE_LIMIT) sampleCache.clear();
    missing.forEach(({ c, i }, j) => {
      const sample = computed![j]!;
      results[i] = sample;
      sampleCache.set(cacheKey(c), sample);
    });
  }

  return results as SoftProofSample[];
}

export async function softProofSample(
  rgb: RgbColor,
  profile: ProfileInfo,
): Promise<SoftProofSample> {
  const [sample] = await softProofBatch([rgb], profile);
  return sample!;
}

export async function softProofImageBuffer(
  input: Buffer,
  profile: ProfileInfo,
  maxDimension = 1600,
): Promise<{ buffer: Buffer; width: number; height: number; usedApproximate: boolean }> {
  const { data, info } = await sharp(input)
    .rotate()
    .resize(maxDimension, maxDimension, { fit: "inside", withoutEnlargement: true })
    .removeAlpha()
    .toColorspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });

  const icc = profileIccPath(profile);
  if (icc && !profile.approximate) {
    try {
      const { proof, proofChannels } = await iccRoundTrip(data, info.width, info.height, icc);
      const png = await sharp(proof, {
        raw: { width: info.width, height: info.height, channels: proofChannels as 3 | 4 },
      })
        .png()
        .toBuffer();
      return { buffer: png, width: info.width, height: info.height, usedApproximate: false };
    } catch {
      // fall through to approximate soft proof
    }
  }

  const out = Buffer.alloc(info.width * info.height * 3);
  for (let i = 0, j = 0; i < data.length; i += info.channels, j += 3) {
    const proof = approximateSoftProofRgb({ r: data[i]!, g: data[i + 1]!, b: data[i + 2]! });
    out[j] = proof.r;
    out[j + 1] = proof.g;
    out[j + 2] = proof.b;
  }

  const png = await sharp(out, {
    raw: { width: info.width, height: info.height, channels: 3 },
  })
    .png()
    .toBuffer();

  return { buffer: png, width: info.width, height: info.height, usedApproximate: true };
}

export async function exportCmykTiff(
  input: Buffer,
  profile: ProfileInfo,
): Promise<Buffer | null> {
  const icc = profileIccPath(profile);
  if (!icc || profile.approximate) return null;

  try {
    return await sharp(input)
      .rotate()
      .removeAlpha()
      .toColorspace("srgb")
      .withIccProfile(icc)
      .toColorspace("cmyk")
      .tiff({ compression: "lzw" })
      .toBuffer();
  } catch {
    return null;
  }
}
