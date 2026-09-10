import type { AnalyzedColor } from "@cmyk/shared";

/** Remap near-matching pixels for virtual preview (does not modify the uploaded file). */
export async function remapImageUrl(
  sourceUrl: string,
  mappings: Record<string, string>,
  colors: AnalyzedColor[],
  mode: "original" | "proof",
): Promise<string> {
  if (Object.keys(mappings).length === 0) return sourceUrl;

  const img = await loadImage(sourceUrl);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return sourceUrl;
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  const ops = Object.entries(mappings).map(([from, to]) => {
    const color = colors.find((c) => c.hex.toUpperCase() === from.toUpperCase());
    const fromRgb =
      mode === "original"
        ? hexToRgb(from)
        : hexToRgb(color?.softProofHex ?? from);
    const toRgb =
      mode === "original"
        ? hexToRgb(to)
        : hexToRgb(
            color?.suggestions.find((s) => s.hex.toUpperCase() === to.toUpperCase())
              ?.softProofHex ?? to,
          );
    return { fromRgb, toRgb };
  });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    for (const op of ops) {
      const dr = r - op.fromRgb.r;
      const dg = g - op.fromRgb.g;
      const db = b - op.fromRgb.b;
      if (dr * dr + dg * dg + db * db < 48 * 48) {
        data[i] = op.toRgb.r;
        data[i + 1] = op.toRgb.g;
        data[i + 2] = op.toRgb.b;
        break;
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const n = Number.parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
