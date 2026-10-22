import { prisma } from "@/lib/db";
import type { TelegramUser } from "@/lib/hunting-gathering";
import { userName } from "@/lib/hunting-gathering";
import { formatMoscow } from "@/lib/timezone";

/** Сколько дней хранить журнал обращений. */
const KEEP_DAYS = 365;

export type BotTopic = { section: string; topic: string; title: string };

export const USAGE_PERIODS = [7, 30, 90, 365] as const;

export async function logBotUsage(input: {
  from?: TelegramUser;
  chat: { id: number; type?: string; title?: string };
  topic: BotTopic;
  text: string;
}): Promise<void> {
  if (!input.from) {
    return;
  }
  await prisma.huntingBotEvent
    .create({
      data: {
        userId: String(input.from.id),
        name: userName(input.from),
        username: input.from.username ?? "",
        chatId: String(input.chat.id),
        chatType: input.chat.type ?? "",
        chatTitle: input.chat.title ?? "",
        ...input.topic,
        text: input.text.slice(0, 200),
      },
    })
    .catch((error) => console.error("hunting usage log", error));
}

export async function pruneBotUsage(now = new Date()): Promise<void> {
  await prisma.huntingBotEvent.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - KEEP_DAYS * 86_400_000) } },
  });
}

type Count = { key: string; label: string; count: number; users: number };

function countBy<T>(items: T[], key: (item: T) => string, label: (item: T) => string, user: (item: T) => string): Count[] {
  const map = new Map<string, { label: string; count: number; users: Set<string> }>();
  for (const item of items) {
    const id = key(item);
    const entry = map.get(id) ?? { label: label(item), count: 0, users: new Set<string>() };
    entry.count += 1;
    entry.users.add(user(item));
    map.set(id, entry);
  }
  return [...map.entries()]
    .map(([id, entry]) => ({ key: id, label: entry.label, count: entry.count, users: entry.users.size }))
    .sort((a, b) => b.count - a.count);
}

export type UsageUser = {
  userId: string;
  name: string;
  username: string;
  count: number;
  lastAt: Date;
  topSection: string;
  where: string;
};

export async function getBotUsageStats(days: number, now = new Date()) {
  const since = new Date(now.getTime() - days * 86_400_000);
  const events = await prisma.huntingBotEvent.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
  });

  const sections = countBy(events, (e) => e.section, (e) => e.section, (e) => e.userId);
  const topics = countBy(events, (e) => `${e.section}|${e.topic}`, (e) => e.title, (e) => e.userId);
  const chats = countBy(
    events.filter((e) => e.chatType !== "private"),
    (e) => e.chatId,
    (e) => e.chatTitle || `чат ${e.chatId}`,
    (e) => e.userId,
  );

  const byUser = new Map<string, typeof events>();
  for (const event of events) {
    byUser.set(event.userId, [...(byUser.get(event.userId) ?? []), event]);
  }
  const users: UsageUser[] = [...byUser.entries()]
    .map(([userId, list]) => {
      const places = new Set(list.map((e) => (e.chatType === "private" ? "личка" : "группа")));
      return {
        userId,
        name: list[0].name,
        username: list[0].username,
        count: list.length,
        lastAt: list[0].createdAt,
        topSection: countBy(list, (e) => e.section, (e) => e.section, (e) => e.userId)[0]?.label ?? "",
        where: [...places].join(", "),
      };
    })
    .sort((a, b) => b.count - a.count);

  const dayKey = (date: Date) => formatMoscow(date, { year: "numeric", month: "2-digit", day: "2-digit" });
  const perDay = new Map<string, number>();
  for (const event of events) {
    perDay.set(dayKey(event.createdAt), (perDay.get(dayKey(event.createdAt)) ?? 0) + 1);
  }
  const timeline = Array.from({ length: Math.min(days, 90) }, (_, index) => {
    const date = new Date(now.getTime() - (Math.min(days, 90) - 1 - index) * 86_400_000);
    return {
      label: formatMoscow(date, { day: "numeric", month: "short" }),
      count: perDay.get(dayKey(date)) ?? 0,
    };
  });

  return {
    total: events.length,
    users,
    privateCount: events.filter((e) => e.chatType === "private").length,
    sections,
    topics: topics.slice(0, 20),
    chats,
    timeline,
    recent: events.slice(0, 50),
  };
}
