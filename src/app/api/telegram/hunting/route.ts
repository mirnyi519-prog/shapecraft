import { NextResponse } from "next/server";
import { handleHuntingUpdate, huntingWebhookSecret } from "@/lib/hunting-bot";

/** Webhook охотничьего бота: Telegram присылает сюда команды из группы и лички. */
export async function POST(request: Request) {
  const secret = huntingWebhookSecret();
  if (!secret || request.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const update = await request.json().catch(() => null);
  if (update) {
    await handleHuntingUpdate(update).catch((error) => console.error("hunting bot update", error));
  }
  return NextResponse.json({ ok: true });
}
