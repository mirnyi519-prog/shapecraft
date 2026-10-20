import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getFilamentSummary, recordFilamentPrice } from "@/lib/filament";
import { isFilamentMarketplace, normalizeFilamentQuery } from "@/lib/filament-shared";

function authError(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  if (error instanceof Error && error.message === "FORBIDDEN") {
    return NextResponse.json({ error: "Только для админа" }, { status: 403 });
  }
  return null;
}

/** Цена, найденная вручную на WB / Ozon / Маркете. */
export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = (await request.json().catch(() => null)) as {
      query?: string;
      marketplace?: string;
      price?: number | string;
      url?: string;
      title?: string;
    } | null;

    const query = normalizeFilamentQuery(body?.query ?? "");
    const marketplace = body?.marketplace;
    const price = Math.round(Number(String(body?.price ?? "").replace(/[^\d.,]/g, "").replace(",", ".")));
    if (!query || !isFilamentMarketplace(marketplace)) {
      return NextResponse.json({ error: "Не указан запрос или площадка" }, { status: 400 });
    }
    if (!Number.isFinite(price) || price < 50 || price > 100_000) {
      return NextResponse.json({ error: "Цена — число в рублях" }, { status: 400 });
    }
    const url = (body?.url ?? "").trim();
    if (url && !/^https:\/\//i.test(url)) {
      return NextResponse.json({ error: "Ссылка должна начинаться с https://" }, { status: 400 });
    }

    await recordFilamentPrice({
      query,
      marketplace,
      price,
      url,
      title: (body?.title ?? "").trim(),
      source: "manual",
    });
    return NextResponse.json({ summary: await getFilamentSummary(query) });
  } catch (error) {
    return authError(error) ?? NextResponse.json({ error: "Не удалось сохранить" }, { status: 500 });
  }
}

/** Удалить ошибочную запись. */
export async function DELETE(request: Request) {
  try {
    await requireAdmin();
    const id = new URL(request.url).searchParams.get("id") ?? "";
    const row = await prisma.filamentPrice.findUnique({ where: { id }, select: { query: true } });
    if (!row) {
      return NextResponse.json({ error: "Запись не найдена" }, { status: 404 });
    }
    await prisma.filamentPrice.delete({ where: { id } });
    return NextResponse.json({ summary: await getFilamentSummary(row.query) });
  } catch (error) {
    return authError(error) ?? NextResponse.json({ error: "Не удалось удалить" }, { status: 500 });
  }
}
