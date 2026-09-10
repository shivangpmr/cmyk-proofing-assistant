import type { LabColor, RgbColor } from "@cmyk/shared";
import { rgbToHsl, rgbToLab } from "./colorMath.js";

export function explainShift(
  original: RgbColor,
  softProof: RgbColor,
  deltaE: number,
): string {
  if (deltaE < 3) {
    return "This color should reproduce closely in the selected CMYK soft proof.";
  }

  const oLab = rgbToLab(original);
  const pLab = rgbToLab(softProof);
  const oHsl = rgbToHsl(original);
  const chromaLoss = Math.hypot(oLab.a, oLab.b) - Math.hypot(pLab.a, pLab.b);
  const lightDelta = pLab.L - oLab.L;

  const hue = oHsl.h;
  const sat = oHsl.s;

  if (sat > 70 && hue >= 250 && hue <= 300) {
    return "Highly saturated violet is outside the printable CMYK gamut, so the proof loses some blue/magenta intensity.";
  }
  if (sat > 70 && hue >= 210 && hue < 250) {
    return "Pure RGB blue is likely to become darker and less saturated when converted to CMYK.";
  }
  if (sat > 65 && hue >= 90 && hue <= 160) {
    return "Bright RGB green cannot be reproduced at the same luminance in this CMYK profile.";
  }
  if (sat > 70 && (hue <= 20 || hue >= 340)) {
    return "Highly saturated reds often lose punch in CMYK; the soft proof looks slightly duller.";
  }
  if (sat > 70 && hue > 300 && hue < 340) {
    return "Neon pinks/magentas sit near the edge of coated CMYK; expect a softer, less electric result.";
  }
  if (sat > 75 && hue > 160 && hue < 200) {
    return "Electric cyan is difficult to hold in CMYK ink; the proof pulls toward a more muted teal.";
  }
  if (chromaLoss > 12 && lightDelta < -3) {
    return "This color sits outside the CMYK gamut, so the soft proof becomes darker and less vivid.";
  }
  if (chromaLoss > 10) {
    return "Saturation is reduced in the soft proof because the color exceeds the selected print gamut.";
  }
  if (Math.abs(lightDelta) > 6) {
    return lightDelta < 0
      ? "The CMYK simulation darkens this color to stay within printable ink limits."
      : "Lightness shifts in the soft proof as the color is mapped into the CMYK gamut.";
  }
  return "This color shifts perceptibly when mapped into the selected CMYK profile.";
}

export function nameColor(rgb: RgbColor, lab: LabColor): string {
  const hsl = rgbToHsl(rgb);
  if (hsl.s < 8) {
    if (hsl.l > 90) return "Near White";
    if (hsl.l < 15) return "Near Black";
    return "Neutral Gray";
  }
  if (hsl.s > 70 && hsl.l > 40 && hsl.l < 70) {
    if (hsl.h >= 250 && hsl.h <= 295) return "Electric Violet";
    if (hsl.h >= 210 && hsl.h < 250) return "Electric Blue";
    if (hsl.h >= 90 && hsl.h <= 150) return "Neon Green";
    if (hsl.h > 300 && hsl.h < 340) return "Hot Pink";
    if (hsl.h <= 15 || hsl.h >= 350) return "Vivid Red";
  }
  if (hsl.h < 30 || hsl.h >= 330) return "Red";
  if (hsl.h < 70) return "Orange / Yellow";
  if (hsl.h < 160) return "Green";
  if (hsl.h < 200) return "Cyan";
  if (hsl.h < 260) return "Blue";
  if (hsl.h < 300) return "Violet";
  return "Magenta";
}
