import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { extensionForImage, getUploadsDir } from "@/lib/upload";
import {
  getWeekLabel,
  isWorldPriceTier,
  type WorldPriceTier,
} from "@/lib/world-trends";

export type WorldTrendImportArticle = {
  name: string;
  description: string;
  priceTier: WorldPriceTier;
  priceLabel: string;
  sourceUrl: string;
  imageUrl?: string | null;
};

export type ImportWorldTrendsResult = {
  batchId: string;
  weekLabel: string;
  articleCount: number;
  imagesLoaded: number;
};

const TIER_LIMIT = 5;
const KEEP_BATCHES = 8;
const MAKERWORLD_MODEL_ID_RE = /\/models\/(\d+)/;
const MAKERWORLD_CDN_HOSTS = ["makerworld.bblmw.com", "public-cdn.bblmw.com"];
const IMAGE_EXT_TO_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

const FETCH_HEADERS = {
  "User-Agent": "ShapeCraftWorldAgent/1.0 (+https://shapecraft.ru)",
  Accept: "text/html,application/xhtml+xml,application/json",
  Referer: "https://makerworld.com/",
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function mimeFromImageUrl(url: string): string | null {
  const path = url.split("?")[0]?.toLowerCase() ?? "";
  for (const [ext, mime] of Object.entries(IMAGE_EXT_TO_MIME)) {
    if (path.endsWith(ext)) {
      return mime;
    }
  }
  return null;
}

function isAllowedRemoteImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return false;
    }
    if (MAKERWORLD_CDN_HOSTS.some((host) => parsed.hostname === host)) {
      return true;
    }
    return Boolean(mimeFromImageUrl(url));
  } catch {
    return false;
  }
}

async function fetchMakerWorldCoverUrl(sourceUrl: string): Promise<string | null> {
  const match = sourceUrl.match(MAKERWORLD_MODEL_ID_RE);
  if (!match?.[1]) {
    return null;
  }

  try {
    const response = await fetch(
      `https://api.bambulab.com/v1/design-service/design/${match[1]}`,
      {
        headers: FETCH_HEADERS,
        signal: AbortSignal.timeout(12_000),
      },
    );

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as { coverUrl?: string };
    const coverUrl = data.coverUrl?.trim();
    return coverUrl && isAllowedRemoteImageUrl(coverUrl) ? coverUrl : null;
  } catch {
    return null;
  }
}

async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(12_000),
      redirect: "follow",
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    const patterns = [
      /property=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["']/i,
      /content=["']([^"']+)["'][^>]*property=["']og:image(?::secure_url)?["']/i,
      /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) {
        return match[1].trim();
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function saveRemoteImage(
  imageUrl: string,
  filenameStem: string,
): Promise<string | null> {
  if (!isAllowedRemoteImageUrl(imageUrl)) {
    return null;
  }

  try {
    const response = await fetch(imageUrl, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(15_000),
      redirect: "follow",
    });

    if (!response.ok) {
      return null;
    }

    const headerType =
      response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ??
      "";
    const contentType =
      headerType.startsWith("image/") && headerType !== "image/svg+xml"
        ? headerType
        : mimeFromImageUrl(imageUrl) ?? "image/jpeg";

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < 512 || buffer.length > 25_000_000) {
      return null;
    }

    const ext = extensionForImage("", contentType);
    const uploadDir = getUploadsDir();
    await mkdir(uploadDir, { recursive: true });
    const filename = `world-${filenameStem}${ext}`;
    await writeFile(path.join(uploadDir, filename), buffer);
    return `/api/media/${filename}`;
  } catch {
    return null;
  }
}

async function resolveArticleImage(
  article: WorldTrendImportArticle,
  index: number,
): Promise<string | null> {
  const makerWorldCover =
    article.sourceUrl.includes("makerworld.com")
      ? await fetchMakerWorldCoverUrl(article.sourceUrl)
      : null;

  const candidates = [
    article.imageUrl?.trim(),
    makerWorldCover,
    article.sourceUrl ? await fetchOgImage(article.sourceUrl) : null,
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const saved = await saveRemoteImage(
      candidate,
      `${Date.now()}-${index}-${slugify(article.name) || "souvenir"}`,
    );
    if (saved) {
      return saved;
    }

    if (isAllowedRemoteImageUrl(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function parseImportArticles(raw: unknown): WorldTrendImportArticle[] {
  const list = Array.isArray(raw)
    ? raw
    : raw &&
        typeof raw === "object" &&
        Array.isArray((raw as { articles?: unknown[] }).articles)
      ? (raw as { articles: unknown[] }).articles
      : null;

  if (!list) {
    throw new Error("Ожидается JSON-масс articles или массив статей");
  }

  const articles: WorldTrendImportArticle[] = [];

  for (const item of list) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const row = item as Record<string, unknown>;
    const priceTier = String(row.priceTier ?? "");
    if (!isWorldPriceTier(priceTier)) {
      continue;
    }

    const name = String(row.name ?? "").trim();
    const description = String(row.description ?? "").trim();
    const priceLabel = String(row.priceLabel ?? "").trim();
    const sourceUrl = String(row.sourceUrl ?? "").trim();

    if (!name || description.length < 20 || !priceLabel || !sourceUrl) {
      continue;
    }

    articles.push({
      name: name.slice(0, 120),
      description: description.slice(0, 1200),
      priceTier,
      priceLabel: priceLabel.slice(0, 80),
      sourceUrl: sourceUrl.slice(0, 500),
      imageUrl:
        typeof row.imageUrl === "string" ? row.imageUrl.slice(0, 500) : null,
    });
  }

  return normalizeImportArticles(articles);
}

export function normalizeImportArticles(
  articles: WorldTrendImportArticle[],
): WorldTrendImportArticle[] {
  const buckets: Record<WorldPriceTier, WorldTrendImportArticle[]> = {
    expensive: [],
    medium: [],
    cheap: [],
  };

  for (const article of articles) {
    const bucket = buckets[article.priceTier];
    if (bucket.length < TIER_LIMIT) {
      bucket.push(article);
    }
  }

  for (const tier of ["expensive", "medium", "cheap"] as WorldPriceTier[]) {
    if (buckets[tier].length !== TIER_LIMIT) {
      throw new Error(
        `Нужно по ${TIER_LIMIT} моделей в каждом сегменте, получено: expensive=${buckets.expensive.length}, medium=${buckets.medium.length}, cheap=${buckets.cheap.length}`,
      );
    }
  }

  return [...buckets.expensive, ...buckets.medium, ...buckets.cheap];
}

export async function importWorldTrends(input: {
  articles: WorldTrendImportArticle[];
  force?: boolean;
  source?: string;
}): Promise<ImportWorldTrendsResult> {
  const normalized = normalizeImportArticles(input.articles);
  const weekLabel = getWeekLabel();
  const existing = await prisma.worldTrendBatch.findUnique({
    where: { weekLabel },
  });

  if (existing && !input.force) {
    const articles = await prisma.worldTrendArticle.findMany({
      where: { batchId: existing.id },
      select: { imageUrl: true },
    });
    return {
      batchId: existing.id,
      weekLabel,
      articleCount: articles.length,
      imagesLoaded: articles.filter((item) => Boolean(item.imageUrl)).length,
    };
  }

  const images = await Promise.all(
    normalized.map((article, index) => resolveArticleImage(article, index)),
  );

  const batch = await prisma.$transaction(async (tx) => {
    if (existing) {
      await tx.worldTrendBatch.delete({ where: { id: existing.id } });
    }

    const created = await tx.worldTrendBatch.create({
      data: {
        weekLabel,
        source: input.source ?? "cursor-agent",
        articles: {
          create: normalized.map((article, index) => ({
            name: article.name,
            description: article.description,
            imageUrl: images[index],
            sourceUrl: article.sourceUrl,
            priceTier: article.priceTier,
            priceLabel: article.priceLabel,
            sortOrder: index,
          })),
        },
      },
    });

    const oldBatches = await tx.worldTrendBatch.findMany({
      orderBy: { generatedAt: "desc" },
      skip: KEEP_BATCHES,
      select: { id: true },
    });

    if (oldBatches.length > 0) {
      await tx.worldTrendBatch.deleteMany({
        where: { id: { in: oldBatches.map((item) => item.id) } },
      });
    }

    return created;
  });

  return {
    batchId: batch.id,
    weekLabel,
    articleCount: normalized.length,
    imagesLoaded: images.filter(Boolean).length,
  };
}

export async function publishWorldTrendsPayload(input: {
  payload: unknown;
  force?: boolean;
  publishUrl?: string;
  secret?: string;
}): Promise<ImportWorldTrendsResult & { published: true }> {
  const publishUrl =
    input.publishUrl ??
    process.env.WORLD_PUBLISH_URL ??
    "https://shapecraft.ru/api/world/import";
  const secret = input.secret ?? process.env.WORLD_IMPORT_SECRET;

  if (!secret) {
    throw new Error(
      "WORLD_IMPORT_SECRET не задан — добавьте секрет в .env локально и на сервере",
    );
  }

  const articles = parseImportArticles(input.payload);
  const response = await fetch(publishUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({
      articles,
      force: Boolean(input.force),
    }),
    signal: AbortSignal.timeout(120_000),
  });

  const data = (await response.json()) as ImportWorldTrendsResult & {
    error?: string;
    ok?: boolean;
  };

  if (!response.ok) {
    throw new Error(data.error ?? `Ошибка выгрузки (${response.status})`);
  }

  return {
    batchId: data.batchId,
    weekLabel: data.weekLabel,
    articleCount: data.articleCount,
    imagesLoaded: data.imagesLoaded ?? 0,
    published: true,
  };
}

export function getWorldSyncSourceUrl(): string {
  return (
    process.env.WORLD_SYNC_URL?.trim() ||
    "https://raw.githubusercontent.com/mirnyi519-prog/shapecraft/master/data/world-import.json"
  );
}

export async function syncWorldTrendsFromSource(input?: {
  force?: boolean;
  sourceUrl?: string;
}): Promise<ImportWorldTrendsResult> {
  const sourceUrl = input?.sourceUrl ?? getWorldSyncSourceUrl();
  const response = await fetch(sourceUrl, {
    headers: {
      Accept: "application/json",
      "User-Agent": "ShapeCraftWorldAgent/1.0 (+https://shapecraft.ru)",
    },
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Не удалось загрузить подборку (${response.status})`);
  }

  const payload = (await response.json()) as unknown;
  const articles = parseImportArticles(payload);

  return importWorldTrends({
    articles,
    force: input?.force ?? true,
    source: "github-sync",
  });
}

export async function triggerRemoteWorldSync(input?: {
  force?: boolean;
  baseUrl?: string;
  secret?: string;
}): Promise<ImportWorldTrendsResult & { published: true }> {
  const publishUrl = process.env.WORLD_PUBLISH_URL?.trim();
  const baseUrl =
    input?.baseUrl ??
    (publishUrl
      ? publishUrl.replace(/\/api\/world\/import\/?$/, "")
      : "https://shapecraft.ru");
  const secret = input?.secret ?? process.env.WORLD_IMPORT_SECRET;

  if (!secret) {
    throw new Error(
      "WORLD_IMPORT_SECRET не задан — добавьте секрет в .env локально и на сервере",
    );
  }

  const response = await fetch(`${baseUrl}/api/world/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ force: input?.force ?? true }),
    signal: AbortSignal.timeout(120_000),
  });

  const data = (await response.json()) as ImportWorldTrendsResult & {
    error?: string;
    ok?: boolean;
  };

  if (!response.ok) {
    throw new Error(data.error ?? `Ошибка синхронизации (${response.status})`);
  }

  return {
    batchId: data.batchId,
    weekLabel: data.weekLabel,
    articleCount: data.articleCount,
    imagesLoaded: data.imagesLoaded ?? 0,
    published: true,
  };
}

export async function getLatestWorldTrendBatch() {
  return prisma.worldTrendBatch.findFirst({
    orderBy: { generatedAt: "desc" },
    include: {
      articles: {
        orderBy: [{ priceTier: "asc" }, { sortOrder: "asc" }],
      },
    },
  });
}

/** @deprecated используйте importWorldTrends */
export const generateWorldTrends = importWorldTrends;
