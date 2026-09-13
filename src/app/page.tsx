import { ProductCatalog } from "@/components/product-catalog";
import { CatalogLineToggle } from "@/components/catalog-line-toggle";
import { FeedbackForm } from "@/components/feedback-form";
import { LocationBlock } from "@/components/location-block";
import { PublicShell } from "@/components/public-shell";
import { StorefrontBanner } from "@/components/storefront-banner";
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
import {
  getLatestWorldTrendBatchView,
} from "@/lib/world-trends-data";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ line?: string }>;
}) {
  const params = await searchParams;
  const catalogLine = parseCatalogLine(params.line);

  const [products, newProducts, popularProducts, categories, banner, worldBatch] =
    await Promise.all([
      getActiveCatalogProducts(catalogLine),
      getNewCatalogProducts(6, catalogLine),
      getPopularCatalogProducts(6, catalogLine),
      listActiveCategoriesForCatalogLine(catalogLine),
      getActiveStoreBanner(),
      getLatestWorldTrendBatchView(),
    ]);

  const worldTrendArticles = worldBatch?.articles ?? [];
  const lineLabel = CATALOG_LINE_LABELS[catalogLine];

  return (
    <PublicShell>
      <div className="space-y-6">
        {banner ? <StorefrontBanner banner={banner} /> : null}
        <CatalogLineToggle current={catalogLine} />
        <div>
          <h1 className="text-2xl font-bold">{lineLabel}</h1>
          <p className="text-[var(--muted)]">
            Актуальные цены и остатки в пекарне
          </p>
        </div>
        <ProductCatalog
          products={products}
          categories={categories}
          newProducts={newProducts}
          popularProducts={popularProducts}
          catalogLineLabel={lineLabel}
        />
        <LocationBlock />
        <FeedbackForm />
        <WorldTrendsStrip articles={worldTrendArticles} />
      </div>
    </PublicShell>
  );
}
