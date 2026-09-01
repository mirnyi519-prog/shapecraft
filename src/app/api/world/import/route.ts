import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { isWorldImportAuthorized } from "@/lib/world-import-auth";
import {
  getLatestWorldTrendBatch,
  importWorldTrends,
  parseImportArticles,
} from "@/lib/world-trends-bot";

export async function POST(request: NextRequest) {
  try {
    if (!isWorldImportAuthorized(request)) {
      await requireAdmin();
    }

    const body = (await request.json()) as {
      articles?: unknown;
      force?: boolean;
    };

    const articles = parseImportArticles(body.articles ?? body);
    const result = await importWorldTrends({
      articles,
      force: Boolean(body.force),
      source: isWorldImportAuthorized(request) ? "cursor-agent-remote" : "admin-import",
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }
    const message =
      error instanceof Error ? error.message : "Ошибка импорта подборки";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET() {
  try {
    const batch = await getLatestWorldTrendBatch();
    if (!batch) {
      return NextResponse.json({ batch: null });
    }

    return NextResponse.json({
      batch: {
        id: batch.id,
        weekLabel: batch.weekLabel,
        generatedAt: batch.generatedAt.toISOString(),
        source: batch.source,
        articles: batch.articles.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          imageUrl: item.imageUrl,
          sourceUrl: item.sourceUrl,
          priceTier: item.priceTier,
          priceLabel: item.priceLabel,
          sortOrder: item.sortOrder,
        })),
      },
    });
  } catch {
    return NextResponse.json({ error: "Ошибка загрузки" }, { status: 500 });
  }
}
