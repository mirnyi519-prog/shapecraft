import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getSalesChartSeries,
  parseSalesChartPeriod,
} from "@/lib/sales-stats";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const period = parseSalesChartPeriod(
      request.nextUrl.searchParams.get("period"),
    );
    const series = await getSalesChartSeries(period);
    return NextResponse.json(series);
  } catch {
    return NextResponse.json({ error: "Ошибка загрузки" }, { status: 500 });
  }
}
