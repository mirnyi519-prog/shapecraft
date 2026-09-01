import { NextResponse } from "next/server";

/** Устарело: используйте POST /api/world/import */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Генерация через OpenAI отключена. Попросите агента Cursor обновить подборку «В мире» или импортируйте JSON через POST /api/world/import",
    },
    { status: 410 },
  );
}

export async function GET() {
  const { getLatestWorldTrendBatch } = await import("@/lib/world-trends-bot");
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
