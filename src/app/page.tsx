import type { Metadata } from "next";
import { ProductCatalog } from "@/components/product-catalog";
import { FeedbackForm } from "@/components/feedback-form";
import { LocationBlock } from "@/components/location-block";
import { PublicShell } from "@/components/public-shell";
import { StorefrontBanner } from "@/components/storefront-banner";
import { StorefrontGate, type GatePhoto } from "@/components/storefront-gate";
import { StorefrontHero } from "@/components/storefront-hero";
import { WorldTrendsStrip } from "@/components/world-trends-strip";
import { getActiveStoreBanner } from "@/lib/banner";
import { listActiveCategoriesForCatalogLine } from "@/lib/categories-data";
import {
  CATALOG_LINE_LABELS,
  isCatalogLine,
  parseCatalogLine,
  type CatalogLine,
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
import type { WorldTrendArticleView } from "@/lib/world-trends";
import {
  getLatestWorldTrendBatchView,
  pickWorldTrendHighlights,
} from "@/lib/world-trends-data";

async function lineCoverPhotos(line: CatalogLine): Promise<GatePhoto[]> {
  const products = await prisma.product.findMany({
    where: {
      active: true,
      catalogLine: line,
      NOT: {
        AND: [{ stock: { lte: 0 } }, { zeroStockMode: "hide" }],
      },
    },
    orderBy: [{ stock: "desc" }, { name: "asc" }],
    take: 16,
    select: {
      id: true,
      name: true,
      imageUrl: true,
      images: {
        orderBy: { sortOrder: "asc" },
        take: 1,
        select: { url: true },
      },
    },
  });

  return products
    .map((product) => ({
      id: product.id,
      name: product.name,
      imageUrl: product.images[0]?.url || product.imageUrl || "",
    }))
    .filter((product) => product.imageUrl.trim())
    .slice(0, 5);
}

function worldCoverPhotos(articles: WorldTrendArticleView[]): GatePhoto[] {
  const preferred = pickWorldTrendHighlights(articles, 5);
  const seen = new Set(preferred.map((article) => article.id));
  const ordered = [
    ...preferred,
    ...articles.filter((article) => !seen.has(article.id)),
  ];

  return ordered
    .filter((article) => article.imageUrl?.trim())
    .slice(0, 5)
    .map((article) => ({
      id: article.id,
      name: article.name,
      imageUrl: article.imageUrl as string,
    }));
}

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
  searchParams: Promise<{ line?: string; p?: string; view?: string }>;
}) {
  const params = await searchParams;
  const rawLine = Array.isArray(params.line) ? params.line[0] : params.line;
  const rawView = Array.isArray(params.view) ? params.view[0] : params.view;
  const initialProductId = params.p?.trim() || null;
  let catalogLine: CatalogLine | null = isCatalogLine(rawLine) ? rawLine : null;

  if (!catalogLine && initialProductId) {
    const linked = await prisma.product.findFirst({
      where: { id: initialProductId, active: true },
      select: { catalogLine: true },
    });
    catalogLine = parseCatalogLine(linked?.catalogLine);
  }

  if (!catalogLine && !initialProductId && rawView === "world") {
    const worldBatch = await getLatestWorldTrendBatchView();
    const articles = worldBatch?.articles ?? [];

    return (
      <PublicShell>
        <div className="space-y-8 sm:space-y-10">
          <WorldTrendsStrip articles={articles} expanded title="В мире" />
          {articles.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              Подборка идей скоро появится.
            </p>
          ) : null}
          <LocationBlock />
          <FeedbackForm />
        </div>
      </PublicShell>
    );
  }

  if (!catalogLine) {
    const [souvenir, home, worldBatch] = await Promise.all([
      lineCoverPhotos("souvenir"),
      lineCoverPhotos("home"),
      getLatestWorldTrendBatchView(),
    ]);

    return (
      <PublicShell>
        <StorefrontGate
          covers={{ souvenir, home }}
          worldPhotos={worldCoverPhotos(worldBatch?.articles ?? [])}
        />
      </PublicShell>
    );
  }

  const [products, newProducts] = await Promise.all([
    getActiveCatalogProducts(catalogLine),
    getNewCatalogProducts(4, catalogLine),
  ]);

  const [popularProducts, categories, banner, worldBatch, hoursConfig] =
    await Promise.all([
      getPopularCatalogProducts(
        4,
        catalogLine,
        newProducts.map((product) => product.id),
      ),
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
        {banner ? <StorefrontBanner banner={banner} /> : null}
        <ProductCatalog
          key={catalogLine}
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
