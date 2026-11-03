import { createHash } from "node:crypto";
import { readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";
import { formatMoscow } from "@/lib/timezone";
import { getUploadsDir } from "@/lib/upload";

const DAY = 86_400_000;

/** Текст и фото новости живут столько дней; сама строка — дольше, для «Качества источников». */
export const NEWS_KEEP_DAYS = 14;
/** «Качество источников» считается за 90 дней — строки без текста держим с запасом. */
const NEWS_ROW_DAYS = 120;
/** Тексты запросов и ответов бота — для «Последних обращений». */
export const BOT_TEXT_DAYS = 14;
/** IP и браузер посетителя; сам визит остаётся для графиков. */
export const VISIT_IP_DAYS = 14;
const SECURITY_DAYS = 30;
/** Файл, который только что загрузили в форму товара, ещё может быть не сохранён в базе. */
const ORPHAN_GRACE_DAYS = 2;
/** Уборка — ночью по Москве. */
const NIGHT_HOURS = [3, 4, 5];

export type RetentionReport = {
  newsTrimmed: number;
  newsDeleted: number;
  botTrimmed: number;
  visitsAnonymized: number;
  securityDeleted: number;
  filesDeleted: number;
  bytesFreed: number;
};

async function trimNews(now: Date) {
  const trimmed = await prisma.huntingIncident.updateMany({
    where: { publishedAt: { lt: new Date(now.getTime() - NEWS_KEEP_DAYS * DAY) }, text: { not: "" } },
    data: { text: "", photoUrl: null, photoFileId: null, photosJson: "", adminAlbumIds: "" },
  });
  const deleted = await prisma.huntingIncident.deleteMany({
    where: { publishedAt: { lt: new Date(now.getTime() - NEWS_ROW_DAYS * DAY) } },
  });
  return { newsTrimmed: trimmed.count, newsDeleted: deleted.count };
}

async function trimBotLog(now: Date) {
  const result = await prisma.huntingBotEvent.updateMany({
    where: {
      createdAt: { lt: new Date(now.getTime() - BOT_TEXT_DAYS * DAY) },
      OR: [{ text: { not: "" } }, { reply: { not: "" } }],
    },
    data: { text: "", reply: "" },
  });
  return result.count;
}

/** Обезличенный id вместо IP: уникальные посетители на графиках считаются как раньше. */
function anonymousVisitorId(ip: string): string {
  const salt = process.env.AUTH_SECRET ?? "shapecraft";
  return `ip-${createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 16)}`;
}

async function anonymizeVisits(now: Date) {
  const before = new Date(now.getTime() - VISIT_IP_DAYS * DAY);
  let total = 0;
  for (;;) {
    const rows = await prisma.siteVisit.findMany({
      where: { visitedAt: { lt: before }, ipAddress: { not: "" } },
      select: { id: true, ipAddress: true, visitorId: true },
      take: 500,
    });
    if (rows.length === 0) {
      return total;
    }
    await prisma.$transaction(
      rows.map((row) =>
        prisma.siteVisit.update({
          where: { id: row.id },
          data: { ipAddress: "", userAgent: null, visitorId: row.visitorId ?? anonymousVisitorId(row.ipAddress) },
        }),
      ),
    );
    total += rows.length;
  }
}

async function trimSecurityLog(now: Date) {
  const result = await prisma.securityEvent.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - SECURITY_DAYS * DAY) } },
  });
  return result.count;
}

/** Имена файлов /api/media/…, на которые ссылается хоть одно поле любой таблицы. */
async function referencedMedia(): Promise<Set<string>> {
  const tables = await prisma.$queryRawUnsafe<{ name: string }[]>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'",
  );
  const names = new Set<string>();
  for (const { name } of tables) {
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(`SELECT * FROM "${name}"`);
    for (const row of rows) {
      for (const value of Object.values(row)) {
        if (typeof value === "string" && (value.includes("/api/media/") || value.includes("/uploads/"))) {
          for (const match of value.matchAll(/\/(?:api\/media|uploads)\/([^"'\s)?#,]+)/g)) {
            names.add(decodeURIComponent(match[1]));
          }
        }
      }
    }
  }
  return names;
}

/** Фото, которые больше нигде не используются: старые картинки «В мире», заменённые фото товаров. */
async function removeOrphanUploads(now: Date) {
  const dir = getUploadsDir();
  const files = await readdir(dir).catch(() => [] as string[]);
  if (files.length === 0) {
    return { filesDeleted: 0, bytesFreed: 0 };
  }
  const used = await referencedMedia();
  if (used.size === 0) {
    return { filesDeleted: 0, bytesFreed: 0 };
  }
  let filesDeleted = 0;
  let bytesFreed = 0;
  for (const file of files) {
    if (file.startsWith(".")) {
      continue;
    }
    const original = file.replace(/\.(card|view)\.webp$/, "");
    if (used.has(original)) {
      continue;
    }
    const full = path.join(dir, file);
    const info = await stat(full).catch(() => null);
    if (!info?.isFile() || now.getTime() - info.mtime.getTime() < ORPHAN_GRACE_DAYS * DAY) {
      continue;
    }
    await unlink(full).then(
      () => {
        filesDeleted += 1;
        bytesFreed += info.size;
      },
      (error) => console.error("retention unlink", file, error),
    );
  }
  return { filesDeleted, bytesFreed };
}

export async function runRetention(now = new Date()): Promise<RetentionReport> {
  const news = await trimNews(now);
  const botTrimmed = await trimBotLog(now);
  const visitsAnonymized = await anonymizeVisits(now);
  const securityDeleted = await trimSecurityLog(now);
  const files = await removeOrphanUploads(now);
  return { ...news, botTrimmed, visitsAnonymized, securityDeleted, ...files };
}

/** Раз в сутки ночью; если сервер ночью стоял — при первом запуске после 48 часов. */
export async function runRetentionIfDue(now = new Date()): Promise<void> {
  const setting = await prisma.appSetting.findUnique({ where: { id: "default" }, select: { lastRetentionAt: true } });
  const last = setting?.lastRetentionAt?.getTime() ?? 0;
  const hour = Number(formatMoscow(now, { hour: "2-digit", hourCycle: "h23" }));
  const due = now.getTime() - last > 2 * DAY || (NIGHT_HOURS.includes(hour) && now.getTime() - last > 20 * 3_600_000);
  if (!due) {
    return;
  }
  await prisma.appSetting.upsert({
    where: { id: "default" },
    create: { id: "default", lastRetentionAt: now },
    update: { lastRetentionAt: now },
  });
  const report = await runRetention(now);
  console.log("retention", JSON.stringify(report));
}
