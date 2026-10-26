import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { backfillIncidents } from "@/lib/hunting-incidents";

export const maxDuration = 300;

const ALLOWED_DAYS = [7, 14, 30];

/** Ручная проверка новостей за период: подходящее — модератору в личку бота. */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = (await request.json().catch(() => null)) as { days?: number } | null;
    const days = ALLOWED_DAYS.includes(Number(body?.days)) ? Number(body?.days) : 30;
    return NextResponse.json({ result: await backfillIncidents(days) });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Только для админа" }, { status: 403 });
    }
    return NextResponse.json({ error: "Проверка не удалась" }, { status: 500 });
  }
}
