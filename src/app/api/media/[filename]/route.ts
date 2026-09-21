import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { NextRequest, NextResponse } from "next/server";
import { getMimeType, getUploadsDir } from "@/lib/upload";

type Params = { params: Promise<{ filename: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { filename } = await params;
    const safeName = path.basename(filename);
    if (!safeName || safeName !== filename || filename.includes("..")) {
      return NextResponse.json({ error: "Некорректное имя файла" }, { status: 400 });
    }

    const filePath = path.join(getUploadsDir(), safeName);
    const fileStat = await stat(filePath);
    const ext = path.extname(safeName);
    const nodeStream = createReadStream(filePath);
    const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;

    return new NextResponse(webStream, {
      headers: {
        "Content-Type": getMimeType(ext),
        "Content-Length": String(fileStat.size),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Файл не найден" }, { status: 404 });
  }
}
