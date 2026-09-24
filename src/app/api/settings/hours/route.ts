import { NextRequest, NextResponse } from "next/server";
import { isAdmin, requireSession } from "@/lib/auth";
import {
  WEEKDAY_ORDER,
  isHoursMode,
  parseClockToMinutes,
  type HoursMode,
  type PickupDayHours,
  type PickupHoursWeek,
} from "@/lib/pickup-hours";
import {
  ensureStoreSettings,
  updateStoreHours,
} from "@/lib/store-settings";

export const runtime = "nodejs";

function parseDayInput(raw: unknown): PickupDayHours | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const row = raw as {
    closed?: boolean;
    open?: string;
    close?: string;
  };
  if (row.closed) {
    return { closed: true };
  }
  const openMinute = parseClockToMinutes(row.open ?? "");
  const closeMinute = parseClockToMinutes(row.close ?? "");
  if (openMinute == null || closeMinute == null || openMinute >= closeMinute) {
    return null;
  }
  return { closed: false, openMinute, closeMinute };
}

function parseWeekInput(raw: unknown): PickupHoursWeek | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const source = raw as Record<string, unknown>;
  const week = {} as PickupHoursWeek;
  for (const day of WEEKDAY_ORDER) {
    const parsed = parseDayInput(source[String(day)]);
    if (!parsed) {
      return null;
    }
    week[day] = parsed;
  }
  return week;
}

export async function GET() {
  try {
    const session = await requireSession();
    if (!isAdmin(session.role)) {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }
    const settings = await ensureStoreSettings();
    return NextResponse.json(settings);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    return NextResponse.json({ error: "Ошибка загрузки" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!isAdmin(session.role)) {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }

    const body = (await request.json()) as {
      hoursMode?: HoursMode;
      winterStartMonth?: number;
      winterStartDay?: number;
      winterEndMonth?: number;
      winterEndDay?: number;
      summerHours?: unknown;
      winterHours?: unknown;
    };

    if (!isHoursMode(body.hoursMode)) {
      return NextResponse.json({ error: "Некорректный режим" }, { status: 400 });
    }

    const summerHours = parseWeekInput(body.summerHours);
    const winterHours = parseWeekInput(body.winterHours);
    if (!summerHours || !winterHours) {
      return NextResponse.json(
        { error: "Проверьте часы: формат ЧЧ:ММ, открытие раньше закрытия" },
        { status: 400 },
      );
    }

    const winterStartMonth = Math.round(Number(body.winterStartMonth));
    const winterStartDay = Math.round(Number(body.winterStartDay));
    const winterEndMonth = Math.round(Number(body.winterEndMonth));
    const winterEndDay = Math.round(Number(body.winterEndDay));

    if (
      winterStartMonth < 1 ||
      winterStartMonth > 12 ||
      winterEndMonth < 1 ||
      winterEndMonth > 12 ||
      winterStartDay < 1 ||
      winterStartDay > 31 ||
      winterEndDay < 1 ||
      winterEndDay > 31
    ) {
      return NextResponse.json(
        { error: "Некорректный период зимы" },
        { status: 400 },
      );
    }

    const updated = await updateStoreHours({
      hoursMode: body.hoursMode,
      winterStartMonth,
      winterStartDay,
      winterEndMonth,
      winterEndDay,
      summerHours,
      winterHours,
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    console.error("settings hours put", error);
    return NextResponse.json({ error: "Ошибка сохранения" }, { status: 500 });
  }
}
