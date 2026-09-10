import Color from "colorjs.io";
import type { CmykColor, LabColor, RgbColor } from "@cmyk/shared";

export function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

export function rgbToHex({ r, g, b }: RgbColor): string {
  return (
    "#" +
    [r, g, b]
      .map((v) => clampByte(v).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

export function hexToRgb(hex: string): RgbColor {
  const h = hex.replace("#", "").trim();
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const n = Number.parseInt(full, 16);
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
  };
}

export function rgbToLab(rgb: RgbColor): LabColor {
  const c = new Color("srgb", [rgb.r / 255, rgb.g / 255, rgb.b / 255]);
  const lab = c.to("lab");
  return { L: lab.coords[0] ?? 0, a: lab.coords[1] ?? 0, b: lab.coords[2] ?? 0 };
}

export function labToRgb(lab: LabColor): RgbColor {
  const c = new Color("lab", [lab.L, lab.a, lab.b]);
  const srgb = c.to("srgb");
  const [r, g, b] = srgb.coords.map((v) => clampByte((v ?? 0) * 255));
  return { r, g, b };
}

export function rgbToHsl(rgb: RgbColor): { h: number; s: number; l: number } {
  const c = new Color("srgb", [rgb.r / 255, rgb.g / 255, rgb.b / 255]);
  const hsl = c.to("hsl");
  return {
    h: Math.round(((hsl.coords[0] ?? 0) + 360) % 360),
    s: Math.round((hsl.coords[1] ?? 0)),
    l: Math.round((hsl.coords[2] ?? 0)),
  };
}

/** ΔE2000 between two Lab colors. */
export function deltaE00(a: LabColor, b: LabColor): number {
  const ca = new Color("lab", [a.L, a.a, a.b]);
  const cb = new Color("lab", [b.L, b.a, b.b]);
  return Number(ca.deltaE(cb, "2000").toFixed(2));
}

/**
 * Display CMYK percentages derived from RGB via undercolor removal.
 * Used only when ICC channel readout is unavailable — not the soft-proof engine.
 */
export function rgbToCmykDisplay(rgb: RgbColor): CmykColor {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const k = 1 - Math.max(r, g, b);
  if (k >= 0.999) return { c: 0, m: 0, y: 0, k: 100 };
  const c = (1 - r - k) / (1 - k);
  const m = (1 - g - k) / (1 - k);
  const y = (1 - b - k) / (1 - k);
  return {
    c: Math.round(c * 100),
    m: Math.round(m * 100),
    y: Math.round(y * 100),
    k: Math.round(k * 100),
  };
}

export function cmykBytesToPercent(c: number, m: number, y: number, k: number): CmykColor {
  return {
    c: Math.round((c / 255) * 100),
    m: Math.round((m / 255) * 100),
    y: Math.round((y / 255) * 100),
    k: Math.round((k / 255) * 100),
  };
}

/**
 * Approximate CMYK soft-proof when no ICC profile is installed.
 * Compresses chroma in Lab toward a coated-offset-like gamut and slightly
 * darkens highly saturated hues (especially blues/violets/neons).
 * In-gamut colors are left unchanged so repeated soft-proofing is stable.
 */
export function approximateSoftProofRgb(rgb: RgbColor): RgbColor {
  const lab = rgbToLab(rgb);
  const chroma = Math.hypot(lab.a, lab.b);
  if (chroma < 1) return rgb;

  const hue = Math.atan2(lab.b, lab.a);
  const hueDeg = ((hue * 180) / Math.PI + 360) % 360;

  // Approximate coated CMYK max chroma by hue (rough FOGRA39-like envelope)
  let maxChroma = 58;
  if (hueDeg > 250 && hueDeg < 310) maxChroma = 38; // violet/blue
  else if (hueDeg >= 210 && hueDeg <= 250) maxChroma = 40; // blue
  else if (hueDeg > 100 && hueDeg < 160) maxChroma = 45; // green
  else if (hueDeg > 160 && hueDeg < 200) maxChroma = 42; // cyan
  else if (hueDeg > 300 && hueDeg < 340) maxChroma = 48; // magenta/pink
  else if (hueDeg > 320 || hueDeg < 20) maxChroma = 52; // red
  else if (hueDeg >= 70 && hueDeg <= 100) maxChroma = 55; // yellow-green

  if (chroma <= maxChroma) return rgb;

  const compress = maxChroma / chroma;
  const compressed: LabColor = {
    L: Math.max(0, lab.L - (1 - compress) * 6 - (chroma > 70 ? 2 : 0)),
    a: lab.a * compress,
    b: lab.b * compress,
  };
  return labToRgb(compressed);
}
