import { NextResponse } from "next/server";
import { isAdmin, requireSession } from "@/lib/auth";
import { formatDateTime } from "@/lib/calculations";
import { getTelegramConfig, sendTelegramMessage } from "@/lib/telegram";

export async function GET() {
  try {
    const session = await requireSession();
    if (!isAdmin(session.role)) {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }

    const { configured, token, chatId } = getTelegramConfig();

    return NextResponse.json({
      configured,
      hasToken: Boolean(token),
      hasChatId: Boolean(chatId),
      tokenTail: token ? `…${token.slice(-6)}` : null,
      chatId: chatId || null,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    return NextResponse.json({ error: "Ошибка" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const session = await requireSession();
    if (!isAdmin(session.role)) {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }

    const result = await sendTelegramMessage(
      `✅ Тест ShapeCraft\nВремя: ${formatDateTime(new Date())} (МСК)`,
    );

    return NextResponse.json(result, {
      status: result.ok ? 200 : 502,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    return NextResponse.json({ error: "Ошибка" }, { status: 500 });
  }
}
