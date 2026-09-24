import { NextResponse } from "next/server";
import {
  activeHoursWeek,
  getPickupOpenStatus,
  hoursRowsFromWeek,
  resolveActiveSeason,
} from "@/lib/pickup-hours";
import { getStoreHoursConfig } from "@/lib/store-settings";

export const runtime = "nodejs";

/** Публичный статус графика для витрины. */
export async function GET() {
  try {
    const config = await getStoreHoursConfig();
    const status = getPickupOpenStatus(config);
    const week = activeHoursWeek(config);
    return NextResponse.json({
      status,
      rows: hoursRowsFromWeek(week),
      season: resolveActiveSeason(config),
    });
  } catch (error) {
    console.error("pickup settings public", error);
    return NextResponse.json({ error: "Ошибка загрузки" }, { status: 500 });
  }
}
