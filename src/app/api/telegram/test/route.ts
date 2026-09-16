import { NextRequest, NextResponse } from "next/server";
import { isAdmin, requireSession } from "@/lib/auth";
import { formatDateTime } from "@/lib/calculations";
import {
  getTelegramChannelConfig,
  sendTelegramMessage,
  type TelegramChannel,
} from "@/lib/telegram";

function parseChannel(request: NextRequest): TelegramChannel {
  const raw = request.nextUrl.searchParams.get("channel")?.trim().toLowerCase();
  return raw === "market" ? "market" : "ops";
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!isAdmin(session.role)) {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }

    const channel = parseChannel(request);
    const { configured, token, chatId, label } = getTelegramChannelConfig(channel);

    return NextResponse.json({
      channel,
      label,
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

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!isAdmin(session.role)) {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }

    const channel = parseChannel(request);
    const label =
      channel === "market"
        ? "Маркет / объявления"
        : "Служебный (клики / склад)";

    const result = await sendTelegramMessage(
      [
        "✅ Тест ShapeCraft",
        `Канал: ${label}`,
        `Время: ${formatDateTime(new Date())} (МСК)`,
      ].join("\n"),
      channel,
    );

    return NextResponse.json({ ...result, channel, label }, {
      status: result.ok ? 200 : 502,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    return NextResponse.json({ error: "Ошибка" }, { status: 500 });
  }
}
