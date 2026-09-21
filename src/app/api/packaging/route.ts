import { NextRequest, NextResponse } from "next/server";
import { isAdmin, requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listPackaging, resolveSuggestedPackagingId } from "@/lib/packaging-data";
import { isPackagingCode } from "@/lib/packaging";
import { parseOptionalNumber } from "@/lib/product-specs";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!isAdmin(session.role)) {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }

    const suggest = request.nextUrl.searchParams.get("suggest") === "1";
    if (suggest) {
      const specs = {
        weightGrams: parseOptionalNumber(
          request.nextUrl.searchParams.get("weightGrams"),
        ),
        widthMm: parseOptionalNumber(request.nextUrl.searchParams.get("widthMm")),
        heightMm: parseOptionalNumber(
          request.nextUrl.searchParams.get("heightMm"),
        ),
        depthMm: parseOptionalNumber(request.nextUrl.searchParams.get("depthMm")),
      };
      const result = await resolveSuggestedPackagingId(specs);
      return NextResponse.json(result);
    }

    const items = await listPackaging(true);
    return NextResponse.json(items);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    return NextResponse.json({ error: "Ошибка загрузки" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!isAdmin(session.role)) {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }

    const body = (await request.json()) as {
      code?: string;
      name?: string;
      description?: string;
      boxWidthMm?: number | null;
      boxHeightMm?: number | null;
      boxDepthMm?: number | null;
      stock?: number;
      sortOrder?: number;
    };

    const name = body.name?.trim();
    const code = body.code?.trim().toLowerCase();
    if (!name) {
      return NextResponse.json({ error: "Укажите название" }, { status: 400 });
    }
    if (!code || !isPackagingCode(code)) {
      return NextResponse.json(
        { error: "Код: mini, standard, fragile или long" },
        { status: 400 },
      );
    }

    const created = await prisma.packaging.create({
      data: {
        code,
        name,
        description: body.description?.trim() || null,
        boxWidthMm: parseOptionalNumber(body.boxWidthMm),
        boxHeightMm: parseOptionalNumber(body.boxHeightMm),
        boxDepthMm: parseOptionalNumber(body.boxDepthMm),
        stock: Number.isFinite(Number(body.stock)) ? Math.max(0, Math.round(Number(body.stock))) : 0,
        sortOrder: Number.isFinite(Number(body.sortOrder))
          ? Math.round(Number(body.sortOrder))
          : 0,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    if (
      error instanceof Error &&
      error.message.includes("Unique constraint")
    ) {
      return NextResponse.json({ error: "Такой код уже есть" }, { status: 409 });
    }
    console.error("packaging create", error);
    return NextResponse.json({ error: "Ошибка сохранения" }, { status: 500 });
  }
}
