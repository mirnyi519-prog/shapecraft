import { ProductCatalog } from "@/components/product-catalog";
import { FeedbackForm } from "@/components/feedback-form";
import { LocationBlock } from "@/components/location-block";
import { PublicShell } from "@/components/public-shell";
import { StorefrontBanner } from "@/components/storefront-banner";
import { WorldTrendsStrip } from "@/components/world-trends-strip";
import { getActiveStoreBanner } from "@/lib/banner";
import { listActiveCategories } from "@/lib/categories-data";
import {
  getActiveCatalogProducts,
  getNewCatalogProducts,
  getPopularCatalogProducts,
} from "@/lib/catalog-product";
import {
  getLatestWorldTrendBatchView,
} from "@/lib/world-trends-data";

export default async function HomePage() {
  const [products, newProducts, popularProducts, categories, banner, worldBatch] =
    await Promise.all([
      getActiveCatalogProducts(),
      getNewCatalogProducts(6),
      getPopularCatalogProducts(6),
      listActiveCategories(),
      getActiveStoreBanner(),
      getLatestWorldTrendBatchView(),
    ]);

  const worldTrendArticles = worldBatch?.articles ?? [];

  return (
    <PublicShell>
      <div className="space-y-6">
        {banner ? <StorefrontBanner banner={banner} /> : null}
        <div>
          <h1 className="text-2xl font-bold">Сувениры</h1>
          <p className="text-[var(--muted)]">
            Актуальные цены и остатки в пекарне
          </p>
        </div>
        <ProductCatalog
          products={products}
          categories={categories}
          newProducts={newProducts}
          popularProducts={popularProducts}
        />
        <LocationBlock />
        <FeedbackForm />
        <WorldTrendsStrip articles={worldTrendArticles} />
      </div>
    </PublicShell>
  );
}
