import type { ImageMeta } from "@cmyk/shared";

/** Longest edge sent to the API; matches the server's proof/analysis resolution. */
export const WORKING_MAX_EDGE = 1600;

/** Hosted functions reject request bodies above ~4.5 MB. */
const MAX_UPLOAD_BYTES = 3.5 * 1024 * 1024;

export interface WorkingCopy {
  file: File;
  url: string;
  meta: ImageMeta;
}

/**
 * Downscaled sRGB copy of the upload used for every API call.
 * The original file never leaves the browser.
 */
export async function createWorkingCopy(original: File): Promise<WorkingCopy> {
  const sourceUrl = URL.createObjectURL(original);
  try {
    const img = await loadImage(sourceUrl);
    // SVGs without width/height attributes report 0 intrinsic size.
    const width = img.naturalWidth || WORKING_MAX_EDGE;
    const height = img.naturalHeight || WORKING_MAX_EDGE;
    // Vectors rasterize losslessly, so render them at the full working size.
    const isVector = original.type === "image/svg+xml";
    const fit = WORKING_MAX_EDGE / Math.max(width, height);
    const scale = isVector ? fit : Math.min(1, fit);
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available in this browser.");
    // CMYK has no transparency: preview transparent areas on white paper.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const baseName = original.name.replace(/\.[^.]+$/, "") || "design";
    let blob = await canvasToBlob(canvas, "image/png");
    let ext = "png";
    for (const quality of [0.95, 0.9, 0.82]) {
      if (blob.size <= MAX_UPLOAD_BYTES) break;
      blob = await canvasToBlob(canvas, "image/jpeg", quality);
      ext = "jpg";
    }

    const file = new File([blob], `${baseName}-working.${ext}`, { type: blob.type });
    return {
      file,
      url: URL.createObjectURL(file),
      meta: {
        filename: original.name,
        width,
        height,
        format: original.type.replace("image/", "").toUpperCase() || "Unknown",
        colorMode: "sRGB (assumed)",
      },
    };
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read this image file."));
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode image."))),
      type,
      quality,
    );
  });
}
