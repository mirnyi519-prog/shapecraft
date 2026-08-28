import { NextRequest, NextResponse } from "next/server";
import { createSession, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      login?: string;
      password?: string;
    };

    const login = body.login?.trim().toLowerCase();
    const password = body.password;

    if (!login || !password) {
      return NextResponse.json(
        { error: "Укажите логин и пароль" },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({ where: { login } });
    if (!user || !(await verifyPassword(password, user.password))) {
      return NextResponse.json(
        { error: "Неверный логин или пароль" },
        { status: 401 },
      );
    }

    await createSession({
      id: user.id,
      login: user.login,
      name: user.name,
      role: user.role === "partner" ? "partner" : "admin",
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка входа" }, { status: 500 });
  }
}
