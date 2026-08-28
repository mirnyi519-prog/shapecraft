import { NextRequest, NextResponse } from "next/server";
import {
  hashPassword,
  isValidRole,
  requireAdmin,
} from "@/lib/auth";
import { prisma } from "@/lib/db";

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

export async function GET() {
  try {
    await requireAdmin();
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        login: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });
    return NextResponse.json(users);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }
    return NextResponse.json({ error: "Ошибка загрузки" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = (await request.json()) as {
      login?: string;
      name?: string;
      password?: string;
      role?: string;
    };

    const login = body.login?.trim().toLowerCase();
    const name = body.name?.trim();
    const password = body.password;
    const role = body.role ?? "partner";

    if (!login || !name || !password) {
      return NextResponse.json(
        { error: "Укажите логин, имя и пароль" },
        { status: 400 },
      );
    }

    if (!/^[a-z0-9._-]+$/.test(login)) {
      return NextResponse.json(
        { error: "Логин: латиница, цифры, точка, дефис, подчёркивание" },
        { status: 400 },
      );
    }

    if (!isValidRole(role)) {
      return NextResponse.json({ error: "Некорректная роль" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Пароль не короче 6 символов" },
        { status: 400 },
      );
    }

    const existing = await prisma.user.findUnique({ where: { login } });
    if (existing) {
      return NextResponse.json(
        { error: "Пользователь с таким логином уже есть" },
        { status: 400 },
      );
    }

    const user = await prisma.user.create({
      data: {
        login,
        name,
        password: await hashPassword(password),
        role,
      },
    });

    return NextResponse.json(toPublicUser(user), { status: 201 });
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
