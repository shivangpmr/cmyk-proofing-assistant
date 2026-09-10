export type ProfileId =
  | "auto"
  | "fogra39"
  | "fogra51"
  | "gracol"
  | "swop"
  | "japan-color";

export type ShiftSeverity = "safe" | "minor" | "significant";

export type PrintReadiness = "ready" | "review" | "needs_attention";

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface CmykColor {
  c: number;
  m: number;
  y: number;
  k: number;
}

export interface LabColor {
  L: number;
  a: number;
  b: number;
}

export interface ProfileInfo {
  id: ProfileId;
  label: string;
  shortLabel: string;
  installed: boolean;
  filename: string | null;
  approximate: boolean;
  description: string;
}

export interface ColorSuggestion {
  kind: "closest" | "safer" | "balanced";
  rgb: RgbColor;
  hex: string;
  softProofHex: string;
  softProofRgb: RgbColor;
  cmyk: CmykColor;
  deltaE: number;
  residualDeltaE: number;
}

export interface AnalyzedColor {
  id: string;
  rgb: RgbColor;
  hex: string;
  hsl: { h: number; s: number; l: number };
  lab: LabColor;
  softProofRgb: RgbColor;
  softProofHex: string;
  cmyk: CmykColor;
  deltaE: number;
  severity: ShiftSeverity;
  gamutStatus: "within" | "outside";
  explanation: string;
  weight: number;
  name: string;
  suggestions: ColorSuggestion[];
}

export interface AnalysisSummary {
  readiness: PrintReadiness;
  analyzedCount: number;
  safeCount: number;
  minorCount: number;
  significantCount: number;
  mostAffected: string[];
  overview: string;
}

export interface AnalysisResult {
  profile: ProfileInfo;
  summary: AnalysisSummary;
  colors: AnalyzedColor[];
  analysisWidth: number;
  analysisHeight: number;
  usedApproximate: boolean;
}

export interface ImageMeta {
  filename: string;
  width: number;
  height: number;
  format: string;
  colorMode: string;
}

export const SEED_TEST_COLORS = [
  "#FF0000",
  "#00FF00",
  "#0000FF",
  "#00FFFF",
  "#FF00FF",
  "#FFFF00",
  "#6C2BFF",
  "#00FF85",
  "#FF3B81",
  "#7A00FF",
  "#121212",
  "#FFFFFF",
] as const;
