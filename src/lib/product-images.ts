/** Максимум фото/GIF на товар (первое — обложка). */
export const MAX_PRODUCT_IMAGES = 8;

export function normalizeImageUrls(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const seen = new Set<string>();
  const urls: string[] = [];

  for (const item of input) {
    if (typeof item !== "string") {
      continue;
    }
    const url = item.trim();
    if (!url || url.length > 2000 || seen.has(url)) {
      continue;
    }
    seen.add(url);
    urls.push(url);
    if (urls.length >= MAX_PRODUCT_IMAGES) {
      break;
    }
  }

  return urls;
}

/** Список URL: из ProductImage или fallback на старое поле imageUrl. */
export function resolveProductImageList(product: {
  imageUrl?: string | null;
  images?: { url: string; sortOrder?: number }[] | null;
}): string[] {
  const fromRelation = [...(product.images ?? [])]
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((row) => row.url.trim())
    .filter(Boolean);

  if (fromRelation.length > 0) {
    return normalizeImageUrls(fromRelation);
  }

  const legacy = product.imageUrl?.trim();
  return legacy ? [legacy] : [];
}

export function primaryProductImageUrl(product: {
  imageUrl?: string | null;
  images?: { url: string; sortOrder?: number }[] | null;
  imageUrls?: string[] | null;
}): string | null {
  if (product.imageUrls && product.imageUrls.length > 0) {
    return product.imageUrls[0] ?? null;
  }
  const list = resolveProductImageList(product);
  return list[0] ?? product.imageUrl?.trim() ?? null;
}

type ImageTx = {
  productImage: {
    deleteMany: (args: { where: { productId: string } }) => Promise<unknown>;
    createMany: (args: {
      data: { productId: string; url: string; sortOrder: number }[];
    }) => Promise<unknown>;
  };
  product: {
    update: (args: {
      where: { id: string };
      data: { imageUrl: string | null };
    }) => Promise<unknown>;
  };
};

/** Перезаписывает галерею и синхронизирует imageUrl = первое фото. */
export async function syncProductImages(
  tx: ImageTx,
  productId: string,
  urls: string[],
): Promise<string | null> {
  const normalized = normalizeImageUrls(urls);
  await tx.productImage.deleteMany({ where: { productId } });
  if (normalized.length > 0) {
    await tx.productImage.createMany({
      data: normalized.map((url, sortOrder) => ({
        productId,
        url,
        sortOrder,
      })),
    });
  }
  const cover = normalized[0] ?? null;
  await tx.product.update({
    where: { id: productId },
    data: { imageUrl: cover },
  });
  return cover;
}
