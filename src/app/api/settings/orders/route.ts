import { NextRequest, NextResponse } from "next/server";
import { isAdmin, requireSession } from "@/lib/auth";
import {
  getDeliveryOrdersEnabled,
  getSellerName,
  setDeliveryOrdersEnabled,
  setSellerName,
} from "@/lib/store-settings";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requireSession();
    if (!isAdmin(session.role)) {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }
    const [enabled, sellerName] = await Promise.all([
      getDeliveryOrdersEnabled(),
      getSellerName(),
    ]);
    return NextResponse.json({ enabled, sellerName });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    console.error("settings orders get", error);
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
      enabled?: unknown;
      sellerName?: unknown;
    };
    if (body.enabled !== undefined && typeof body.enabled !== "boolean") {
      return NextResponse.json({ error: "Нужен признак enabled" }, { status: 400 });
    }
    if (body.sellerName !== undefined && typeof body.sellerName !== "string") {
      return NextResponse.json({ error: "Укажите продавца текстом" }, { status: 400 });
    }
    if (body.enabled === undefined && body.sellerName === undefined) {
      return NextResponse.json({ error: "Нечего сохранять" }, { status: 400 });
    }

    const enabled =
      typeof body.enabled === "boolean"
        ? await setDeliveryOrdersEnabled(body.enabled)
        : await getDeliveryOrdersEnabled();
    const sellerName =
      typeof body.sellerName === "string"
        ? await setSellerName(body.sellerName)
        : await getSellerName();
    return NextResponse.json({ enabled, sellerName });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    console.error("settings orders put", error);
    return NextResponse.json({ error: "Ошибка сохранения" }, { status: 500 });
  }
}
