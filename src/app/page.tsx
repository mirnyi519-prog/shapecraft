import type { Metadata } from "next";
import { ProductCatalog } from "@/components/product-catalog";
import { CatalogLineToggle } from "@/components/catalog-line-toggle";
import { FeedbackForm } from "@/components/feedback-form";
import { LocationBlock } from "@/components/location-block";
import { PublicShell } from "@/components/public-shell";
import { StorefrontBanner } from "@/components/storefront-banner";
import { StorefrontHero } from "@/components/storefront-hero";
import { WorldTrendsStrip } from "@/components/world-trends-strip";
import { getActiveStoreBanner } from "@/lib/banner";
import { listActiveCategoriesForCatalogLine } from "@/lib/categories-data";
import {
  CATALOG_LINE_LABELS,
  parseCatalogLine,
} from "@/lib/catalog-line";
import {
  getActiveCatalogProducts,
  getNewCatalogProducts,
  getPopularCatalogProducts,
} from "@/lib/catalog-product";
import { prisma } from "@/lib/db";
import { formatRub } from "@/lib/calculations";
import { getPickupOpenStatus } from "@/lib/pickup-hours";
import { hasListPrice } from "@/lib/pricing";
import { getStoreHoursConfig } from "@/lib/store-settings";
import { getPublicSiteUrl } from "@/lib/telegram";
import { getLatestWorldTrendBatchView } from "@/lib/world-trends-data";

function absoluteMediaUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) {
    return null;
  }
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  return `${getPublicSiteUrl()}${url.startsWith("/") ? url : `/${url}`}`;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ line?: string; p?: string }>;
}): Promise<Metadata> {
  const params = await searchParams;
  const productId = params.p?.trim();
  if (!productId) {
    return {};
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, active: true },
    select: {
      id: true,
      name: true,
      description: true,
      imageUrl: true,
      listPrice: true,
      images: {
        orderBy: { sortOrder: "asc" },
        take: 1,
        select: { url: true },
      },
    },
  });

  if (!product) {
    return {};
  }

  const site = getPublicSiteUrl();
  const cover =
    absoluteMediaUrl(product.images[0]?.url) ||
    absoluteMediaUrl(product.imageUrl);
  const priceBit = hasListPrice(product.listPrice)
    ? ` · ${formatRub(product.listPrice as number)}`
    : "";
  const description =
    product.description?.trim().slice(0, 160) ||
    `Сувенир ShapeCraft${priceBit}. Забрать в пекарне «У Светланы».`;

  return {
    title: `${product.name} — ShapeCraft`,
    description,
    openGraph: {
      title: `${product.name} — ShapeCraft`,
      description,
      url: `${site}/?p=${encodeURIComponent(product.id)}`,
      siteName: "ShapeCraft",
      locale: "ru_RU",
      type: "website",
      ...(cover ? { images: [{ url: cover }] } : {}),
    },
    twitter: {
      card: cover ? "summary_large_image" : "summary",
      title: `${product.name} — ShapeCraft`,
      description,
      ...(cover ? { images: [cover] } : {}),
    },
  };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ line?: string; p?: string }>;
}) {
  const params = await searchParams;
  const catalogLine = parseCatalogLine(params.line);
  const initialProductId = params.p?.trim() || null;

  const [
    products,
    newProducts,
    popularProducts,
    categories,
    banner,
    worldBatch,
    hoursConfig,
  ] = await Promise.all([
    getActiveCatalogProducts(catalogLine),
    getNewCatalogProducts(6, catalogLine),
    getPopularCatalogProducts(6, catalogLine),
    listActiveCategoriesForCatalogLine(catalogLine),
    getActiveStoreBanner(),
    getLatestWorldTrendBatchView(),
    getStoreHoursConfig(),
  ]);

  const worldTrendArticles = worldBatch?.articles ?? [];
  const lineLabel = CATALOG_LINE_LABELS[catalogLine];
  const openStatus = getPickupOpenStatus(hoursConfig);

  return (
    <PublicShell>
      <div className="space-y-8 sm:space-y-10">
        <StorefrontHero lineLabel={lineLabel} openStatus={openStatus} />
        <CatalogLineToggle current={catalogLine} />
        {banner ? <StorefrontBanner banner={banner} /> : null}
        <ProductCatalog
          products={products}
          categories={categories}
          newProducts={newProducts}
          popularProducts={popularProducts}
          catalogLineLabel={lineLabel}
          initialProductId={initialProductId}
        />
        <LocationBlock />
        <FeedbackForm />
        <WorldTrendsStrip articles={worldTrendArticles} />
      </div>
    </PublicShell>
  );
}
