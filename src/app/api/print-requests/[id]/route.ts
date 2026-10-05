import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isPrintRequestStatus } from "@/lib/print-request";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const body = (await request.json()) as { status?: string };
    if (!body.status || !isPrintRequestStatus(body.status)) {
      return NextResponse.json({ error: "Некорректный статус" }, { status: 400 });
    }

    const updated = await prisma.printRequest.update({
      where: { id },
      data: { status: body.status },
      select: { id: true, status: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }
    return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 });
  }
}
