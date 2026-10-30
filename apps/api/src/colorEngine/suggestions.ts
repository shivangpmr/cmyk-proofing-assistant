import type { ColorSuggestion, ProfileInfo, RgbColor } from "@cmyk/shared";
import { softProofBatch, softProofSample, type SoftProofSample } from "./convert.js";
import { deltaE00, labToRgb, rgbToHex, rgbToLab } from "./colorMath.js";

/** Smallest ΔE00 gain worth suggesting; below this the change is imperceptible. */
const MIN_IMPROVEMENT = 0.5;

interface CandidateScore {
  rgb: RgbColor;
  hex: string;
  softProofRgb: RgbColor;
  softProofHex: string;
  cmyk: ColorSuggestion["cmyk"];
  deltaE: number;
  residualDeltaE: number;
  similarity: number;
  printability: number;
}

function scoreCandidate(
  candidate: RgbColor,
  originalLab: ReturnType<typeof rgbToLab>,
  proof: SoftProofSample,
): CandidateScore {
  const candLab = rgbToLab(candidate);
  const proofLab = rgbToLab(proof.softProofRgb);
  const deltaE = deltaE00(originalLab, proofLab);
  const residualDeltaE = deltaE00(candLab, proofLab);
  return {
    rgb: candidate,
    hex: rgbToHex(candidate),
    softProofRgb: proof.softProofRgb,
    softProofHex: proof.softProofHex,
    cmyk: proof.cmyk,
    deltaE,
    residualDeltaE,
    similarity: deltaE,
    printability: residualDeltaE,
  };
}

function dedupeRgb(items: RgbColor[]): RgbColor[] {
  const seen = new Set<string>();
  const out: RgbColor[] = [];
  for (const rgb of items) {
    const hex = rgbToHex(rgb);
    if (seen.has(hex)) continue;
    seen.add(hex);
    out.push(rgb);
  }
  return out;
}

/**
 * Search for RGB alternatives whose CMYK soft proof is closer to the intended color.
 */
export async function suggestAlternatives(
  original: RgbColor,
  profile: ProfileInfo,
): Promise<ColorSuggestion[]> {
  const originalLab = rgbToLab(original);
  const chroma = Math.hypot(originalLab.a, originalLab.b);
  const hue = Math.atan2(originalLab.b, originalLab.a);

  const originalProof = await softProofSample(original, profile);
  const originalDelta = deltaE00(originalLab, rgbToLab(originalProof.softProofRgb));
  const proofLab = rgbToLab(originalProof.softProofRgb);

  // Priority candidates first (always evaluated)
  const priority: RgbColor[] = [originalProof.softProofRgb];
  for (let t = 0.2; t <= 1; t += 0.2) {
    priority.push(
      labToRgb({
        L: originalLab.L * (1 - t) + proofLab.L * t,
        a: originalLab.a * (1 - t) + proofLab.a * t,
        b: originalLab.b * (1 - t) + proofLab.b * t,
      }),
    );
  }

  // Strong chroma reductions toward printable range
  for (const cf of [0.85, 0.7, 0.55, 0.45, 0.35, 0.25]) {
    for (const ld of [0, -3, -6, 3]) {
      priority.push(
        labToRgb({
          L: Math.max(0, Math.min(100, originalLab.L + ld)),
          a: Math.cos(hue) * chroma * cf,
          b: Math.sin(hue) * chroma * cf,
        }),
      );
    }
  }

  // Broader search (evaluated after priority, up to budget)
  const broader: RgbColor[] = [];
  for (const cf of [0.95, 0.8, 0.65, 0.5, 0.4]) {
    for (const ld of [0, -2, -5, 2]) {
      for (const hj of [0, -0.06, 0.06]) {
        broader.push(
          labToRgb({
            L: Math.max(0, Math.min(100, originalLab.L + ld)),
            a: Math.cos(hue + hj) * chroma * cf,
            b: Math.sin(hue + hj) * chroma * cf,
          }),
        );
      }
    }
  }

  const originalHex = rgbToHex(original);
  const ordered = dedupeRgb([...priority, ...broader]).filter(
    (rgb) => rgbToHex(rgb) !== originalHex,
  );
  const toScore = ordered.slice(0, 70);
  if (toScore.length === 0) toScore.push(originalProof.softProofRgb);

  const proofs = await softProofBatch(toScore, profile);
  // A suggestion must print visibly closer to the intended color than the original does.
  const scored = toScore
    .map((rgb, i) => scoreCandidate(rgb, originalLab, proofs[i]!))
    .filter((s) => s.deltaE <= originalDelta - MIN_IMPROVEMENT);

  if (scored.length === 0) return [];

  const closest = [...scored].sort(
    (a, b) => a.similarity - b.similarity || a.printability - b.printability,
  )[0]!;

  const printable = scored.filter((s) => s.printability <= 3);
  const safer =
    (printable.length
      ? [...printable].sort((a, b) => a.similarity - b.similarity || a.printability - b.printability)
      : [...scored].sort((a, b) => a.printability - b.printability || a.similarity - b.similarity))[0]!;

  const balanced = [...scored].sort((a, b) => {
    const score = (s: CandidateScore) =>
      s.similarity * 0.45 + s.printability * 0.55 + (s.printability > 5 ? 4 : 0);
    return score(a) - score(b);
  })[0]!;

  const toSuggestion = (
    kind: ColorSuggestion["kind"],
    s: CandidateScore,
  ): ColorSuggestion => ({
    kind,
    rgb: s.rgb,
    hex: s.hex,
    softProofHex: s.softProofHex,
    softProofRgb: s.softProofRgb,
    cmyk: s.cmyk,
    deltaE: s.deltaE,
    residualDeltaE: s.residualDeltaE,
  });

  const picks: [ColorSuggestion["kind"], CandidateScore][] = [
    ["balanced", balanced],
    ["closest", closest],
    ["safer", safer],
  ];
  const seen = new Set<string>();
  const unique = picks.filter(([, s]) => {
    if (seen.has(s.hex)) return false;
    seen.add(s.hex);
    return true;
  });
  return unique.map(([kind, s]) => toSuggestion(kind, s));
}
