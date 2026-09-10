import type { RgbColor } from "@cmyk/shared";
import { rgbToHex, rgbToLab } from "./colorMath.js";

export interface ClusterColor {
  rgb: RgbColor;
  hex: string;
  weight: number;
}

/**
 * Quantize image pixels into dominant color clusters.
 * Operates on a downscaled buffer — not every unique pixel in the UI.
 */
export function clusterColors(
  data: Buffer,
  width: number,
  height: number,
  channels: number,
  maxColors = 12,
): ClusterColor[] {
  const buckets = new Map<string, { r: number; g: number; b: number; n: number }>();
  const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 40000)));

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * channels;
      const a = channels === 4 ? data[i + 3]! : 255;
      if (a < 16) continue;
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      const key = `${r >> 3},${g >> 3},${b >> 3}`;
      const existing = buckets.get(key);
      if (existing) {
        existing.r += r;
        existing.g += g;
        existing.b += b;
        existing.n += 1;
      } else {
        buckets.set(key, { r, g, b, n: 1 });
      }
    }
  }

  const sorted = [...buckets.values()]
    .map((b) => ({
      rgb: {
        r: Math.round(b.r / b.n),
        g: Math.round(b.g / b.n),
        b: Math.round(b.b / b.n),
      },
      weight: b.n,
    }))
    .sort((a, b) => b.weight - a.weight);

  const merged: ClusterColor[] = [];
  for (const item of sorted) {
    const lab = rgbToLab(item.rgb);
    const near = merged.find((m) => {
      const ml = rgbToLab(m.rgb);
      const d = Math.hypot(lab.L - ml.L, lab.a - ml.a, lab.b - ml.b);
      return d < 8;
    });
    if (near) {
      const total = near.weight + item.weight;
      near.rgb = {
        r: Math.round((near.rgb.r * near.weight + item.rgb.r * item.weight) / total),
        g: Math.round((near.rgb.g * near.weight + item.rgb.g * item.weight) / total),
        b: Math.round((near.rgb.b * near.weight + item.rgb.b * item.weight) / total),
      };
      near.hex = rgbToHex(near.rgb);
      near.weight = total;
    } else {
      merged.push({
        rgb: item.rgb,
        hex: rgbToHex(item.rgb),
        weight: item.weight,
      });
    }
    if (merged.length >= maxColors * 2) break;
  }

  return merged.sort((a, b) => b.weight - a.weight).slice(0, maxColors);
}
