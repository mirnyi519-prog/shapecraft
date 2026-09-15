import { NextRequest, NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import {
  getVisitsChartSeries,
  parseVisitsChartPeriod,
} from "@/lib/visit-chart";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    if (!isAdmin(session.role)) {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }

    const period = parseVisitsChartPeriod(
      request.nextUrl.searchParams.get("period"),
    );
    const series = await getVisitsChartSeries(period);
    return NextResponse.json(series);
  } catch {
    return NextResponse.json({ error: "Ошибка загрузки" }, { status: 500 });
  }
}
