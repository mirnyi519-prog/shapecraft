import { prisma } from "@/lib/db";
import { escapeHtml } from "@/lib/hunting-format";
import { getTelegramChannelConfig, sendTelegramMessage } from "@/lib/telegram";

/** Разовый сбой (сайт моргнул) не повод писать: тревога, только если ошибки держатся столько часов. */
const FAIL_GRACE_HOURS = 2;
const ERRORS_IN_MESSAGE = 5;

/**
 * Состояние источника после прохода сверки. Пишет в служебный канал, когда ошибки держатся
 * дольше FAIL_GRACE_HOURS, и ещё раз — когда источник снова в порядке.
 */
export async function trackSourceHealth(source: string, label: string, errors: string[]): Promise<void> {
  const failKey = `fail:${source}`;
  const alertKey = `alert:${source}`;
  const [fail, alert] = await Promise.all([
    prisma.huntingNotice.findUnique({ where: { key: failKey } }),
    prisma.huntingNotice.findUnique({ where: { key: alertKey } }),
  ]);

  if (errors.length === 0) {
    if (fail) {
      await prisma.huntingNotice.delete({ where: { key: failKey } });
    }
    if (alert) {
      await prisma.huntingNotice.delete({ where: { key: alertKey } });
      await notifyAdmin(`✅ <b>Бот охоты: ${escapeHtml(label)} — снова обновляется</b>`);
    }
    return;
  }

  if (!fail) {
    await prisma.huntingNotice.create({ data: { key: failKey } });
    return;
  }
  if (alert || Date.now() - fail.sentAt.getTime() < FAIL_GRACE_HOURS * 3_600_000) {
    return;
  }
  const lines = [
    `🛠 <b>Бот охоты: не удаётся обновить ${escapeHtml(label)}</b>`,
    `Ошибки с ${fail.sentAt.toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })} МСК — бот отвечает по последним сохранённым данным.`,
    "",
    ...errors.slice(0, ERRORS_IN_MESSAGE).map((error) => `• ${escapeHtml(error)}`),
  ];
  if (errors.length > ERRORS_IN_MESSAGE) {
    lines.push(`…и ещё ${errors.length - ERRORS_IN_MESSAGE}`);
  }
  if (await notifyAdmin(lines.join("\n"))) {
    await prisma.huntingNotice.create({ data: { key: alertKey } });
  }
}

async function notifyAdmin(html: string): Promise<boolean> {
  if (!getTelegramChannelConfig("ops").configured) {
    console.error("hunting health:", html.replace(/<[^>]+>/g, ""));
    return false;
  }
  const result = await sendTelegramMessage(html, "ops", { html: true });
  return result.ok;
}
