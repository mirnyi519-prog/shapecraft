import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    const product = await prisma.product.findUnique({
      where: { id },
      select: { id: true, active: true },
    });

    if (!product || !product.active) {
      return NextResponse.json({ error: "Товар не найден" }, { status: 404 });
    }

    const updated = await prisma.product.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
      select: { viewCount: true },
    });

    return NextResponse.json({ ok: true, viewCount: updated.viewCount });
  } catch {
    return NextResponse.json({ error: "Ошибка записи просмотра" }, { status: 500 });
  }
}
