import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

type FeedbackPatchBody = {
  read?: boolean;
};

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const body = (await request.json()) as FeedbackPatchBody;

    if (typeof body.read !== "boolean") {
      return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
    }

    const updated = await prisma.feedbackMessage.update({
      where: { id },
      data: { read: body.read },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }
    return NextResponse.json({ error: "Сообщение не найдено" }, { status: 404 });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await context.params;

    await prisma.feedbackMessage.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }
    return NextResponse.json({ error: "Сообщение не найдено" }, { status: 404 });
  }
}
