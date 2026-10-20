import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { connectHuntingBot } from "@/lib/hunting-bot";

/** Подключает команды охотничьего бота (webhook + меню). */
export async function POST() {
  try {
    await requireAdmin();
    const result = await connectHuntingBot();
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? "Telegram отказал" }, { status: 502 });
    }
    return NextResponse.json({ ok: true, username: result.username });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Только для админа" }, { status: 403 });
    }
    return NextResponse.json({ error: "Не удалось подключить" }, { status: 500 });
  }
}
