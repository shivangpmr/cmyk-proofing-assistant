/** Configurable perceptual difference thresholds (ΔE00). */
export const DELTA_E_THRESHOLDS = {
  safeMax: 3,
  minorMax: 8,
} as const;

export type SeverityFromDelta = "safe" | "minor" | "significant";

export function severityFromDeltaE(deltaE: number): SeverityFromDelta {
  if (deltaE < DELTA_E_THRESHOLDS.safeMax) return "safe";
  if (deltaE <= DELTA_E_THRESHOLDS.minorMax) return "minor";
  return "significant";
}

export function severityLabel(severity: SeverityFromDelta): string {
  switch (severity) {
    case "safe":
      return "Safe";
    case "minor":
      return "Minor Shift";
    case "significant":
      return "Significant Shift";
  }
}
