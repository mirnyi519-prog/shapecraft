import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { collectLaws } from "@/lib/hunting-laws";

export const maxDuration = 120;

function authError(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  if (error instanceof Error && error.message === "FORBIDDEN") {
    return NextResponse.json({ error: "Только для админа" }, { status: 403 });
  }
  return null;
}

/** Ручная сверка законов с КонсультантПлюс. */
export async function POST() {
  try {
    await requireAdmin();
    const result = await collectLaws();
    if (!result.ok) {
      return NextResponse.json(
        { error: `КонсультантПлюс не ответил: ${result.errors[0] ?? "нет данных"}`, result },
        { status: 502 },
      );
    }
    return NextResponse.json({ result });
  } catch (error) {
    return authError(error) ?? NextResponse.json({ error: "Сверка не удалась" }, { status: 500 });
  }
}
