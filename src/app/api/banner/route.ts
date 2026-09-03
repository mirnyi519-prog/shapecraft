import { NextRequest, NextResponse } from "next/server";
import { isAdmin, requireSession } from "@/lib/auth";
import {
  getActiveStoreBanner,
  getStoreBannerAdmin,
  updateStoreBanner,
} from "@/lib/banner";

export async function GET(request: NextRequest) {
  try {
    const admin = request.nextUrl.searchParams.get("admin") === "1";

    if (admin) {
      const session = await requireSession();
      if (!isAdmin(session.role)) {
        return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
      }
      return NextResponse.json(await getStoreBannerAdmin());
    }

    return NextResponse.json(await getActiveStoreBanner());
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    return NextResponse.json({ error: "Ошибка загрузки" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!isAdmin(session.role)) {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }

    const body = (await request.json()) as {
      title?: string;
      text?: string;
      imageUrl?: string | null;
      active?: boolean;
    };

    const banner = await updateStoreBanner({
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.text !== undefined ? { text: body.text } : {}),
      ...(Object.prototype.hasOwnProperty.call(body, "imageUrl")
        ? { imageUrl: body.imageUrl }
        : {}),
      ...(body.active !== undefined ? { active: body.active } : {}),
    });

    return NextResponse.json(banner);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    return NextResponse.json({ error: "Ошибка сохранения" }, { status: 500 });
  }
}
