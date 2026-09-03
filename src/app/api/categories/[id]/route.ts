import { NextRequest, NextResponse } from "next/server";
import { isAdmin, requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { slugifyCategoryName } from "@/lib/categories";

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
      sortOrder?: number;
      active?: boolean;
    };

    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Раздел не найден" }, { status: 404 });
    }

    let nextSlug = existing.slug;
    if (body.name !== undefined) {
      const name = body.name.trim();
      if (!name) {
        return NextResponse.json({ error: "Укажите название раздела" }, { status: 400 });
      }

      if (name !== existing.name) {
        const baseSlug = slugifyCategoryName(name);
        nextSlug = baseSlug;
        let suffix = 2;
        while (true) {
          const clash = await prisma.category.findUnique({ where: { slug: nextSlug } });
          if (!clash || clash.id === id) {
            break;
          }
          nextSlug = `${baseSlug}-${suffix}`;
          suffix += 1;
        }
      }
    }

    const category = await prisma.category.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim(), slug: nextSlug } : {}),
        ...(body.sortOrder !== undefined && Number.isFinite(Number(body.sortOrder))
          ? { sortOrder: Number(body.sortOrder) }
          : {}),
        ...(body.active !== undefined ? { active: Boolean(body.active) } : {}),
      },
    });

    return NextResponse.json(category);
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

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requireSession();
    if (!isAdmin(session.role)) {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }

    const { id } = await context.params;
    const existing = await prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: "Раздел не найден" }, { status: 404 });
    }

    await prisma.category.delete({ where: { id } });
    return NextResponse.json({
      ok: true,
      detachedProducts: existing._count.products,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    return NextResponse.json({ error: "Ошибка удаления" }, { status: 500 });
  }
}
