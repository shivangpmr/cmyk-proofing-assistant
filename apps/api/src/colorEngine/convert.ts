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

async function transformRgbViaIcc(
  rgb: RgbColor,
  iccPath: string,
): Promise<{ softProof: RgbColor; cmyk: CmykColor } | null> {
  try {
    const pixel = Buffer.from([
      clampByte(rgb.r),
      clampByte(rgb.g),
      clampByte(rgb.b),
    ]);

    const cmykBuf = await sharp(pixel, {
      raw: { width: 1, height: 1, channels: 3 },
    })
      .toColorspace("srgb")
      .withIccProfile(iccPath)
      .toColorspace("cmyk")
      .raw()
      .toBuffer();

    const c = cmykBuf[0] ?? 0;
    const m = cmykBuf[1] ?? 0;
    const y = cmykBuf[2] ?? 0;
    const k = cmykBuf[3] ?? 0;

    const proofBuf = await sharp(Buffer.from([c, m, y, k]), {
      raw: { width: 1, height: 1, channels: 4 },
    })
      .withIccProfile(iccPath)
      .toColorspace("srgb")
      .raw()
      .toBuffer();

    return {
      softProof: {
        r: proofBuf[0] ?? 0,
        g: proofBuf[1] ?? 0,
        b: proofBuf[2] ?? 0,
      },
      cmyk: cmykBytesToPercent(c, m, y, k),
    };
  } catch {
    return null;
  }
}

export async function softProofSample(
  rgb: RgbColor,
  profile: ProfileInfo,
): Promise<SoftProofSample> {
  const icc = profileIccPath(profile);
  if (icc && !profile.approximate) {
    const viaIcc = await transformRgbViaIcc(rgb, icc);
    if (viaIcc) {
      return {
        softProofRgb: viaIcc.softProof,
        softProofHex: rgbToHex(viaIcc.softProof),
        cmyk: viaIcc.cmyk,
        usedApproximate: false,
      };
    }
  }

  const softProofRgb = approximateSoftProofRgb(rgb);
  return {
    softProofRgb,
    softProofHex: rgbToHex(softProofRgb),
    cmyk: rgbToCmykDisplay(softProofRgb),
    usedApproximate: true,
  };
}

export async function softProofImageBuffer(
  input: Buffer,
  profile: ProfileInfo,
  maxDimension = 1600,
): Promise<{ buffer: Buffer; width: number; height: number; usedApproximate: boolean }> {
  const meta = await sharp(input).rotate().metadata();
  const width = meta.width ?? 1;
  const height = meta.height ?? 1;
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const targetW = Math.max(1, Math.round(width * scale));
  const targetH = Math.max(1, Math.round(height * scale));

  const icc = profileIccPath(profile);
  if (icc && !profile.approximate) {
    try {
      const cmyk = await sharp(input)
        .rotate()
        .resize(targetW, targetH, { fit: "inside", withoutEnlargement: true })
        .removeAlpha()
        .toColorspace("srgb")
        .withIccProfile(icc)
        .toColorspace("cmyk")
        .toBuffer({ resolveWithObject: true });

      const proof = await sharp(cmyk.data, {
        raw: {
          width: cmyk.info.width,
          height: cmyk.info.height,
          channels: 4,
        },
      })
        .withIccProfile(icc)
        .toColorspace("srgb")
        .png()
        .toBuffer();

      return {
        buffer: proof,
        width: cmyk.info.width,
        height: cmyk.info.height,
        usedApproximate: false,
      };
    } catch {
      // fall through to approximate soft proof
    }
  }

  const resized = await sharp(input)
    .rotate()
    .resize(targetW, targetH, { fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = resized;
  const out = Buffer.alloc(info.width * info.height * 3);
  for (let i = 0, j = 0; i < data.length; i += info.channels, j += 3) {
    const proof = approximateSoftProofRgb({
      r: data[i]!,
      g: data[i + 1]!,
      b: data[i + 2]!,
    });
    out[j] = proof.r;
    out[j + 1] = proof.g;
    out[j + 2] = proof.b;
  }

  const png = await sharp(out, {
    raw: { width: info.width, height: info.height, channels: 3 },
  })
    .png()
    .toBuffer();

  return {
    buffer: png,
    width: info.width,
    height: info.height,
    usedApproximate: true,
  };
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
      .withIccProfile(icc)
      .tiff({ compression: "lzw" })
      .toBuffer();
  } catch {
    return null;
  }
}
