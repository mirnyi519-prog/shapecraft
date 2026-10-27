import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { removeNoiseWord } from "@/lib/hunting-incidents";

type RouteContext = {
  params: Promise<{ stem: string }>;
};

/** Убрать слово из шума: посты с ним снова будут приходить модератору. */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    await requireAdmin();
    const { stem } = await context.params;
    await removeNoiseWord(decodeURIComponent(stem));
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Только для админа" }, { status: 403 });
    }
    return NextResponse.json({ error: "Не удалось" }, { status: 500 });
  }
}
