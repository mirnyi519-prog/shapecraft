import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { moderateIncident } from "@/lib/hunting-incidents";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** Решение по новости из админки: { action: "publish" | "skip" }. */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as { action?: string } | null;
    if (body?.action !== "publish" && body?.action !== "skip") {
      return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
    }
    const result = await moderateIncident(id, body.action === "publish");
    return NextResponse.json(result, { status: result.ok ? 200 : 409 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Только для админа" }, { status: 403 });
    }
    return NextResponse.json({ error: "Не удалось" }, { status: 500 });
  }
}
