import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { incidentPhoto } from "@/lib/hunting-incidents";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** Фото новости для админки — через сервер, чтобы не зависеть от устаревающих ссылок CDN Telegram. */
export async function GET(request: Request, context: RouteContext) {
  try {
    await requireAdmin();
  } catch {
    return new NextResponse(null, { status: 403 });
  }
  const { id } = await context.params;
  const index = Number(new URL(request.url).searchParams.get("i") ?? 0);
  const photo = Number.isInteger(index) && index >= 0 ? await incidentPhoto(id, index) : null;
  if (!photo) {
    return new NextResponse(null, { status: 404 });
  }
  return new NextResponse(photo.bytes, {
    headers: { "Content-Type": photo.type, "Cache-Control": "private, max-age=86400" },
  });
}
