import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { generateWorldTrends } from "@/lib/world-trends-bot";

function isCronAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return false;
  }
  const header = request.headers.get("x-cron-secret")?.trim();
  return header === secret;
}

export async function POST(request: NextRequest) {
  try {
    const cron = isCronAuthorized(request);
    let force = false;

    if (!cron) {
      await requireAdmin();
    } else {
      const url = new URL(request.url);
      force = url.searchParams.get("force") === "1";
    }

    if (!cron) {
      const body = (await request.json().catch(() => ({}))) as {
        force?: boolean;
      };
      force = Boolean(body.force);
    }

    const result = await generateWorldTrends({ force });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }
    const message =
      error instanceof Error ? error.message : "Ошибка генерации подборки";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { getLatestWorldTrendBatch } = await import("@/lib/world-trends-bot");
    const batch = await getLatestWorldTrendBatch();
    if (!batch) {
      return NextResponse.json({ batch: null });
    }

    return NextResponse.json({
      batch: {
        id: batch.id,
        weekLabel: batch.weekLabel,
        generatedAt: batch.generatedAt.toISOString(),
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
