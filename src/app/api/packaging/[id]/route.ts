import { NextRequest, NextResponse } from "next/server";
import { isAdmin, requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isPackagingCode } from "@/lib/packaging";
import { parseOptionalNumber } from "@/lib/product-specs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireSession();
    if (!isAdmin(session.role)) {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = (await request.json()) as {
      name?: string;
      description?: string | null;
      code?: string;
      boxWidthMm?: number | null;
      boxHeightMm?: number | null;
      boxDepthMm?: number | null;
      stock?: number;
      sortOrder?: number;
      active?: boolean;
      /** Относительное изменение остатка (+/−) */
      stockDelta?: number;
    };

    const existing = await prisma.packaging.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Не найдено" }, { status: 404 });
    }

    if (
      body.code !== undefined &&
      body.code.trim().toLowerCase() !== existing.code &&
      !isPackagingCode(body.code.trim().toLowerCase())
    ) {
      return NextResponse.json(
        { error: "Код: mini, standard, fragile или long" },
        { status: 400 },
      );
    }

    let nextStock = existing.stock;
    if (Object.prototype.hasOwnProperty.call(body, "stockDelta")) {
      const delta = Number(body.stockDelta);
      if (!Number.isFinite(delta) || !Number.isInteger(delta)) {
        return NextResponse.json(
          { error: "Некорректное изменение остатка" },
          { status: 400 },
        );
      }
      nextStock = Math.max(0, existing.stock + delta);
    } else if (Object.prototype.hasOwnProperty.call(body, "stock")) {
      const stock = Number(body.stock);
      if (!Number.isFinite(stock) || stock < 0) {
        return NextResponse.json({ error: "Некорректный остаток" }, { status: 400 });
      }
      nextStock = Math.round(stock);
    }

    const updated = await prisma.packaging.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.description !== undefined
          ? { description: body.description?.trim() || null }
          : {}),
        ...(body.code !== undefined
          ? { code: body.code.trim().toLowerCase() }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(body, "boxWidthMm")
          ? { boxWidthMm: parseOptionalNumber(body.boxWidthMm) }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(body, "boxHeightMm")
          ? { boxHeightMm: parseOptionalNumber(body.boxHeightMm) }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(body, "boxDepthMm")
          ? { boxDepthMm: parseOptionalNumber(body.boxDepthMm) }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(body, "sortOrder")
          ? { sortOrder: Math.round(Number(body.sortOrder) || 0) }
          : {}),
        ...(body.active !== undefined ? { active: Boolean(body.active) } : {}),
        stock: nextStock,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    console.error("packaging patch", error);
    return NextResponse.json({ error: "Ошибка сохранения" }, { status: 500 });
  }
}
