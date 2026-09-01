import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { isWorldImportAuthorized } from "@/lib/world-import-auth";
import {
  getLatestWorldTrendBatch,
  syncWorldTrendsFromSource,
} from "@/lib/world-trends-bot";

export async function POST(request: NextRequest) {
  try {
    if (!isWorldImportAuthorized(request)) {
      await requireAdmin();
    }

    const body = (await request.json().catch(() => ({}))) as {
      force?: boolean;
    };

    const result = await syncWorldTrendsFromSource({
      force: body.force ?? true,
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
      error instanceof Error ? error.message : "Ошибка синхронизации подборки";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET() {
  try {
    const batch = await getLatestWorldTrendBatch();
    if (!batch) {
      return NextResponse.json({ batch: null });
    }

    const imagesLoaded = batch.articles.filter((item) => item.imageUrl).length;

    return NextResponse.json({
      batch: {
        id: batch.id,
        weekLabel: batch.weekLabel,
        generatedAt: batch.generatedAt.toISOString(),
        source: batch.source,
        articleCount: batch.articles.length,
        imagesLoaded,
      },
    });
  } catch {
    return NextResponse.json({ error: "Ошибка загрузки" }, { status: 500 });
  }
}
