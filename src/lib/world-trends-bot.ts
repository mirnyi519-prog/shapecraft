import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { extensionForImage, getUploadsDir } from "@/lib/upload";
import {
  getWeekLabel,
  isWorldPriceTier,
  type WorldPriceTier,
} from "@/lib/world-trends";

type GeneratedArticle = {
  name: string;
  description: string;
  priceTier: WorldPriceTier;
  priceLabel: string;
  sourceUrl: string;
  imageUrl?: string | null;
};

type BotResult = {
  batchId: string;
  weekLabel: string;
  articleCount: number;
};

const TIER_LIMIT = 5;
const KEEP_BATCHES = 8;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "ShapeCraftWorldBot/1.0",
        Accept: "text/html,application/xhtml+xml",
      },
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
  try {
    const response = await fetch(imageUrl, {
      headers: { "User-Agent": "ShapeCraftWorldBot/1.0" },
      signal: AbortSignal.timeout(15_000),
      redirect: "follow",
    });

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) {
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < 512 || buffer.length > 5_000_000) {
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
  article: GeneratedArticle,
  index: number,
): Promise<string | null> {
  const candidates = [
    article.imageUrl?.trim(),
    article.sourceUrl ? await fetchOgImage(article.sourceUrl) : null,
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const saved = await saveRemoteImage(
      candidate,
      `${Date.now()}-${index}-${slugify(article.name) || "toy"}`,
    );
    if (saved) {
      return saved;
    }
  }

  return null;
}

async function callOpenAiArticles(): Promise<GeneratedArticle[]> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY не задан — добавьте ключ в .env на сервере");
  }

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const weekLabel = getWeekLabel();

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Ты аналитик трендов 3D-печати игрушек. Отвечай только JSON на русском языке.",
        },
        {
          role: "user",
          content: `Подготовь актуальную недельную подборку (${weekLabel}) популярных игрушек для FDM 3D-печати по мировым площадкам (MakerWorld, Printables, Thingiverse, Etsy, Reddit r/3Dprinting).

Нужно ровно 15 позиций:
- 5 expensive — премиум, сложные, крупные, articulation, multi-color (>2500 ₽ на рынке)
- 5 medium — популярные модели среднего сегмента (800–2500 ₽)
- 5 cheap — простые, быстрые в печати, массовый спрос (<800 ₽)

Для каждой позиции верни:
- name — короткое название модели
- description — 2–4 предложения: что это, почему популярно, кому зайдёт
- priceTier — expensive | medium | cheap
- priceLabel — ориентир цены в ₽, например "1200–1800 ₽"
- sourceUrl — реальная или правдоподобная публичная ссылка на модель/страницу

JSON формат:
{
  "articles": [
    {
      "name": "...",
      "description": "...",
      "priceTier": "expensive",
      "priceLabel": "3000–4500 ₽",
      "sourceUrl": "https://..."
    }
  ]
}`,
        },
      ],
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${detail.slice(0, 300)}`);
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI вернул пустой ответ");
  }

  const parsed = JSON.parse(content) as { articles?: unknown[] };
  if (!Array.isArray(parsed.articles)) {
    throw new Error("Некорректный JSON от OpenAI");
  }

  const articles: GeneratedArticle[] = [];
  for (const item of parsed.articles) {
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

  return normalizeArticles(articles);
}

function normalizeArticles(articles: GeneratedArticle[]): GeneratedArticle[] {
  const buckets: Record<WorldPriceTier, GeneratedArticle[]> = {
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

  return [
    ...buckets.expensive,
    ...buckets.medium,
    ...buckets.cheap,
  ];
}

export async function generateWorldTrends(input?: {
  force?: boolean;
}): Promise<BotResult> {
  const weekLabel = getWeekLabel();
  const existing = await prisma.worldTrendBatch.findUnique({
    where: { weekLabel },
  });

  if (existing && !input?.force) {
    return {
      batchId: existing.id,
      weekLabel,
      articleCount: await prisma.worldTrendArticle.count({
        where: { batchId: existing.id },
      }),
    };
  }

  const generated = await callOpenAiArticles();
  const images = await Promise.all(
    generated.map((article, index) => resolveArticleImage(article, index)),
  );

  const batch = await prisma.$transaction(async (tx) => {
    if (existing) {
      await tx.worldTrendBatch.delete({ where: { id: existing.id } });
    }

    const created = await tx.worldTrendBatch.create({
      data: {
        weekLabel,
        source: "openai-bot",
        articles: {
          create: generated.map((article, index) => ({
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
    articleCount: generated.length,
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
