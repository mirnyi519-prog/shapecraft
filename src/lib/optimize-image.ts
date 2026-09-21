import sharp, { type Metadata } from "sharp";

/** Макс. длинная сторона для витрины (ретина-карточки ~400–800 CSS px). */
export const IMAGE_MAX_EDGE = 1600;

/** WebP: визуально почти без потерь при сильном выигрыше в весе. */
export const WEBP_QUALITY = 86;

export type OptimizedImage = {
  buffer: Buffer;
  mimeType: string;
  extension: string;
  /** true — оставили исходник (GIF / нет выигрыша). */
  skipped: boolean;
  reason?: string;
  width?: number;
  height?: number;
};

function isGifBuffer(input: Buffer): boolean {
  return (
    input.length >= 6 &&
    input[0] === 0x47 &&
    input[1] === 0x49 &&
    input[2] === 0x46 &&
    input[3] === 0x38 &&
    (input[4] === 0x39 || input[4] === 0x37) &&
    input[5] === 0x61
  );
}

/**
 * Сжимает фото для веба: авто-ориентация, ресайз, WebP.
 * Анимированные GIF не трогаем.
 */
export async function optimizeImageBuffer(
  input: Buffer,
  mimeHint?: string,
): Promise<OptimizedImage> {
  const hint = (mimeHint || "").toLowerCase();
  if (hint === "image/gif" || isGifBuffer(input)) {
    return {
      buffer: input,
      mimeType: "image/gif",
      extension: ".gif",
      skipped: true,
      reason: "gif",
    };
  }

  let meta: Metadata;
  try {
    meta = await sharp(input, { failOn: "none" }).metadata();
  } catch {
    return {
      buffer: input,
      mimeType: hint || "application/octet-stream",
      extension: ".bin",
      skipped: true,
      reason: "unreadable",
    };
  }

  if (meta.format === "gif" || (meta.pages != null && meta.pages > 1)) {
    return {
      buffer: input,
      mimeType: "image/gif",
      extension: ".gif",
      skipped: true,
      reason: "animated",
    };
  }

  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  let pipeline = sharp(input, { failOn: "none" }).rotate();

  if (width > 0 && height > 0 && Math.max(width, height) > IMAGE_MAX_EDGE) {
    pipeline = pipeline.resize({
      width: IMAGE_MAX_EDGE,
      height: IMAGE_MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  const out = await pipeline
    .webp({ quality: WEBP_QUALITY, effort: 4 })
    .toBuffer();

  if (out.length >= input.length) {
    const ext =
      meta.format === "png"
        ? ".png"
        : meta.format === "webp"
          ? ".webp"
          : ".jpg";
    const mime =
      ext === ".png"
        ? "image/png"
        : ext === ".webp"
          ? "image/webp"
          : "image/jpeg";
    return {
      buffer: input,
      mimeType: mime,
      extension: ext,
      skipped: true,
      reason: "no-gain",
      width,
      height,
    };
  }

  const outMeta = await sharp(out).metadata();
  return {
    buffer: out,
    mimeType: "image/webp",
    extension: ".webp",
    skipped: false,
    width: outMeta.width,
    height: outMeta.height,
  };
}
