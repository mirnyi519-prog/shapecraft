import { NextRequest, NextResponse } from "next/server";
import { isAdmin, requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { slugifyCategoryName } from "@/lib/categories";
import { listActiveCategories, listAdminCategories } from "@/lib/categories-data";

export async function GET(request: NextRequest) {
  try {
    const adminOnly = request.nextUrl.searchParams.get("admin") === "1";

    if (adminOnly) {
      const session = await requireSession();
      if (!isAdmin(session.role)) {
        return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
      }
      const categories = await listAdminCategories();
      return NextResponse.json(categories);
    }

    const categories = await listActiveCategories();
    return NextResponse.json(categories);
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
      name?: string;
      sortOrder?: number;
      active?: boolean;
    };

    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "Укажите название раздела" }, { status: 400 });
    }

    const baseSlug = slugifyCategoryName(name);
    let slug = baseSlug;
    let suffix = 2;
    while (await prisma.category.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    const maxSort = await prisma.category.aggregate({ _max: { sortOrder: true } });
    const sortOrder =
      body.sortOrder !== undefined && Number.isFinite(Number(body.sortOrder))
        ? Number(body.sortOrder)
        : (maxSort._max.sortOrder ?? 0) + 10;

    const category = await prisma.category.create({
      data: {
        name,
        slug,
        sortOrder,
        active: body.active !== false,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Раздел с таким названием уже есть" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Ошибка сохранения" }, { status: 500 });
  }
}
