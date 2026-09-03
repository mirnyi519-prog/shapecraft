import { prisma } from "@/lib/db";

export type StoreBannerView = {
  id: string;
  title: string;
  text: string;
  imageUrl: string | null;
  active: boolean;
  updatedAt: string;
};

function mapBanner(banner: {
  id: string;
  title: string;
  text: string;
  imageUrl: string | null;
  active: boolean;
  updatedAt: Date;
}): StoreBannerView {
  return {
    id: banner.id,
    title: banner.title,
    text: banner.text,
    imageUrl: banner.imageUrl,
    active: banner.active,
    updatedAt: banner.updatedAt.toISOString(),
  };
}

export async function ensureStoreBanner() {
  return prisma.storeBanner.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      title: "",
      text: "",
      imageUrl: null,
      active: false,
    },
  });
}

export async function getStoreBannerAdmin(): Promise<StoreBannerView> {
  const banner = await ensureStoreBanner();
  return mapBanner(banner);
}

export async function getActiveStoreBanner(): Promise<StoreBannerView | null> {
  const banner = await ensureStoreBanner();
  if (!banner.active) {
    return null;
  }

  const hasContent =
    Boolean(banner.title.trim()) ||
    Boolean(banner.text.trim()) ||
    Boolean(banner.imageUrl);

  if (!hasContent) {
    return null;
  }

  return mapBanner(banner);
}

export async function updateStoreBanner(input: {
  title?: string;
  text?: string;
  imageUrl?: string | null;
  active?: boolean;
}): Promise<StoreBannerView> {
  await ensureStoreBanner();

  const banner = await prisma.storeBanner.update({
    where: { id: "default" },
    data: {
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.text !== undefined ? { text: input.text.trim() } : {}),
      ...(Object.prototype.hasOwnProperty.call(input, "imageUrl")
        ? { imageUrl: input.imageUrl?.trim() || null }
        : {}),
      ...(input.active !== undefined ? { active: Boolean(input.active) } : {}),
    },
  });

  return mapBanner(banner);
}
