import { put } from "@vercel/blob";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

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

export async function saveUploadedImage(
  buffer: Buffer,
  originalName: string,
  mimeType?: string,
): Promise<string> {
  const ext = extensionForImage(originalName, mimeType);
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`products/${filename}`, buffer, {
      access: "public",
      contentType: mimeType || getMimeType(ext),
    });
    return blob.url;
  }

  const uploadDir = getUploadsDir();
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), buffer);
  return `/api/media/${filename}`;
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
