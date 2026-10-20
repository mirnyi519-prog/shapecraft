import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  getFilamentSummary,
  recordFilamentPrice,
  searchYandexMarket,
} from "@/lib/filament";
import { normalizeFilamentQuery } from "@/lib/filament-shared";

function authError(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  if (error instanceof Error && error.message === "FORBIDDEN") {
    return NextResponse.json({ error: "Только для админа" }, { status: 403 });
  }
  return null;
}

/** Ищет на Маркете, сохраняет самую низкую цену и отдаёт сводку по запросу. */
export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = (await request.json().catch(() => null)) as { query?: string } | null;
    const query = normalizeFilamentQuery(body?.query ?? "");
    if (!query || query === "Bambu Lab") {
      return NextResponse.json({ error: "Что ищем? Например, PLA Basic" }, { status: 400 });
    }

    const yandex = await searchYandexMarket(query);
    const cheapest = yandex.status === "ok" && !yandex.loose ? yandex.offers[0] : undefined;
    if (cheapest) {
      await recordFilamentPrice({
        query,
        marketplace: "ym",
        price: cheapest.price,
        title: cheapest.title,
        url: cheapest.url,
        imageUrl: cheapest.imageUrl,
        source: "auto",
      });
    }

    return NextResponse.json({ yandex, summary: await getFilamentSummary(query) });
  } catch (error) {
    return authError(error) ?? NextResponse.json({ error: "Поиск не удался" }, { status: 500 });
  }
}
