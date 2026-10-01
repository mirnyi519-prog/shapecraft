import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { NextRequest, NextResponse } from "next/server";
import { ensureCardVariant } from "@/lib/image-variants";
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
    const wantCard = request.nextUrl.searchParams.get("v") === "card";

    if (wantCard && CARD_SOURCE_EXT.has(ext) && !safeName.endsWith(".card.webp")) {
      try {
        const cardPath = await ensureCardVariant(filePath);
        const cardStat = await stat(cardPath);
        return fileResponse(cardPath, cardStat.size, "image/webp");
      } catch (error) {
        console.error("card variant", safeName, error);
      }
    }

    return fileResponse(filePath, fileStat.size, getMimeType(ext));
  } catch {
    return NextResponse.json({ error: "Файл не найден" }, { status: 404 });
  }
}
