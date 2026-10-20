import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { postHuntingSummary } from "@/lib/hunting";

/** Публикует сводку «открыто / скоро» в охотничью группу. */
export async function POST() {
  try {
    await requireAdmin();
    const result = await postHuntingSummary();
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? "Telegram не принял сообщение" }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Только для админа" }, { status: 403 });
    }
    return NextResponse.json({ error: "Не удалось отправить" }, { status: 500 });
  }
}
