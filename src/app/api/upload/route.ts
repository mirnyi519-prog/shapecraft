import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { saveUploadedImage } from "@/lib/upload";

export async function POST(request: NextRequest) {
  try {
    await requireSession();
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Можно загружать только изображения" },
        { status: 400 },
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const url = await saveUploadedImage(buffer, file.name || "paste.png", file.type);

    return NextResponse.json({ url });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    console.error("upload error", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? `Ошибка загрузки: ${error.message}` : "Ошибка загрузки",
      },
      { status: 500 },
    );
  }
}
