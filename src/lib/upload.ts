import { put } from "@vercel/blob";
import { createHash } from "node:crypto";
import { access, mkdir, writeFile } from "fs/promises";
import path from "path";
import { shrinkAnimatedGif } from "@/lib/image-variants";
import { optimizeImageBuffer } from "@/lib/optimize-image";

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export function getUploadsDir(): string {
  return (
    process.env.UPLOADS_DIR ||
    path.join(process.cwd(), "public", "uploads")
  );
}

/**
 * Кладёт картинку в uploads под именем из хеша содержимого: одна и та же картинка — один файл.
 * Файлы uploads нигде не удаляются, поэтому общий файл у нескольких товаров безопасен.
 */
export async function writeUploadOnce(buffer: Buffer, ext: string, prefix = ""): Promise<string> {
  const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 24);
  const filename = `${prefix}${hash}${ext}`;
  const uploadDir = getUploadsDir();
  await mkdir(uploadDir, { recursive: true });
  const target = path.join(uploadDir, filename);
  const exists = await access(target).then(
    () => true,
    () => false,
  );
  if (!exists) {
    await writeFile(target, buffer);
  }
  return filename;
}

export function extensionForImage(
  originalName: string,
  mimeType?: string,
): string {
  const fromName = path.extname(originalName || "");
  if (fromName) {
    return fromName.toLowerCase();
  }
  if (mimeType && MIME_TO_EXT[mimeType]) {
    return MIME_TO_EXT[mimeType];
  }
  return ".png";
}

export type SaveUploadedImageOptions = {
  /** Не сжимать (уже готовый GIF из видео и т.п.). */
  skipOptimize?: boolean;
};

export async function saveUploadedImage(
  buffer: Buffer,
  originalName: string,
  mimeType?: string,
  options?: SaveUploadedImageOptions,
): Promise<string> {
  let outBuffer = buffer;
  let outMime = mimeType;
  let ext = extensionForImage(originalName, mimeType);

  if (!options?.skipOptimize) {
    const optimized = await optimizeImageBuffer(buffer, mimeType);
    if (optimized.extension === ".gif" || optimized.reason === "gif" || optimized.reason === "animated") {
      const smaller = await shrinkAnimatedGif(optimized.buffer);
      outBuffer = smaller;
      outMime = "image/gif";
      ext = ".gif";
    } else {
      outBuffer = optimized.buffer;
      outMime = optimized.mimeType;
      ext = optimized.extension;
    }
  }

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    const blob = await put(`products/${filename}`, outBuffer, {
      access: "public",
      contentType: outMime || getMimeType(ext),
    });
    return blob.url;
  }

  return `/api/media/${await writeUploadOnce(outBuffer, ext)}`;
}

export function getMimeType(ext: string): string {
  switch (ext.toLowerCase()) {
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    default:
      return "image/jpeg";
  }
}
