import { NextRequest, NextResponse } from "next/server";
import {
  hashPassword,
  isValidRole,
  requireAdmin,
} from "@/lib/auth";
import { prisma } from "@/lib/db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function toPublicUser(user: {
  id: string;
  login: string;
  name: string;
  role: string;
  createdAt: Date;
}) {
  return {
    id: user.id,
    login: user.login,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
  };
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireAdmin();
    const { id } = await context.params;
    const body = (await request.json()) as {
      login?: string;
      name?: string;
      password?: string;
      role?: string;
    };

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    const login = body.login?.trim().toLowerCase();
    const name = body.name?.trim();
    const role = body.role;

    if (login && !/^[a-z0-9._-]+$/.test(login)) {
      return NextResponse.json(
        { error: "Логин: латиница, цифры, точка, дефис, подчёркивание" },
        { status: 400 },
      );
    }

    if (role !== undefined && !isValidRole(role)) {
      return NextResponse.json({ error: "Некорректная роль" }, { status: 400 });
    }

    if (
      existing.role === "admin" &&
      role !== undefined &&
      role !== "admin"
    ) {
      const adminCount = await prisma.user.count({ where: { role: "admin" } });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "Нельзя снять роль у последнего админа" },
          { status: 400 },
        );
      }
    }

    if (body.password !== undefined && body.password.length > 0 && body.password.length < 6) {
      return NextResponse.json(
        { error: "Пароль не короче 6 символов" },
        { status: 400 },
      );
    }

    if (login && login !== existing.login) {
      const clash = await prisma.user.findUnique({ where: { login } });
      if (clash) {
        return NextResponse.json(
          { error: "Пользователь с таким логином уже есть" },
          { status: 400 },
        );
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(login ? { login } : {}),
        ...(name ? { name } : {}),
        ...(role ? { role } : {}),
        ...(body.password
          ? { password: await hashPassword(body.password) }
          : {}),
      },
    });

    void session;

    return NextResponse.json(toPublicUser(user));
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }
    return NextResponse.json({ error: "Ошибка сохранения" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requireAdmin();
    const { id } = await context.params;

    if (id === session.id) {
      return NextResponse.json(
        { error: "Нельзя удалить свой аккаунт" },
        { status: 400 },
      );
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    if (existing.role === "admin") {
      const adminCount = await prisma.user.count({ where: { role: "admin" } });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "Нельзя удалить последнего админа" },
          { status: 400 },
        );
      }
    }

    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }
    return NextResponse.json({ error: "Ошибка удаления" }, { status: 500 });
  }
}
