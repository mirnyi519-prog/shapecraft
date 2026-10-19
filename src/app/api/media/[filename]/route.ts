import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { NextRequest, NextResponse } from "next/server";
import { ensureCardVariant, ensureViewVariant } from "@/lib/image-variants";
import { getMimeType, getUploadsDir } from "@/lib/upload";

type Params = { params: Promise<{ filename: string }> };

const CARD_SOURCE_EXT = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".bmp",
  ".tif",
  ".tiff",
]);

function fileResponse(filePath: string, size: number, mime: string) {
  const nodeStream = createReadStream(filePath);
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;
  return new NextResponse(webStream, {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(size),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { filename } = await params;
    const safeName = path.basename(filename);
    if (!safeName || safeName !== filename || filename.includes("..")) {
      return NextResponse.json({ error: "Некорректное имя файла" }, { status: 400 });
    }

    const filePath = path.join(getUploadsDir(), safeName);
    const fileStat = await stat(filePath);
    const ext = path.extname(safeName).toLowerCase();
    const variant = request.nextUrl.searchParams.get("v");
    const isVariantFile = safeName.endsWith(".card.webp") || safeName.endsWith(".view.webp");
    const ensure =
      variant === "card"
        ? ensureCardVariant
        : variant === "view" && ext !== ".gif"
          ? ensureViewVariant
          : null;

    if (ensure && CARD_SOURCE_EXT.has(ext) && !isVariantFile) {
      try {
        const variantPath = await ensure(filePath);
        const variantStat = await stat(variantPath);
        return fileResponse(variantPath, variantStat.size, "image/webp");
      } catch (error) {
        console.error(`${variant} variant`, safeName, error);
      }
    }

    return fileResponse(filePath, fileStat.size, getMimeType(ext));
  } catch {
    return NextResponse.json({ error: "Файл не найден" }, { status: 404 });
  }
}
