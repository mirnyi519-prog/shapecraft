import { ProductCatalog } from "@/components/product-catalog";
import { FeedbackForm } from "@/components/feedback-form";
import { LocationBlock } from "@/components/location-block";
import { PublicShell } from "@/components/public-shell";
import { WorldTrendsStrip } from "@/components/world-trends-strip";
import {
  getActiveCatalogProducts,
  getNewCatalogProducts,
  getPopularCatalogProducts,
} from "@/lib/catalog-product";
import {
  getLatestWorldTrendBatchView,
  pickWorldTrendHighlights,
} from "@/lib/world-trends-data";

export default async function HomePage() {
  const [products, newProducts, popularProducts, worldBatch] = await Promise.all([
    getActiveCatalogProducts(),
    getNewCatalogProducts(6),
    getPopularCatalogProducts(6),
    getLatestWorldTrendBatchView(),
  ]);

  const worldTrendArticles = worldBatch
    ? pickWorldTrendHighlights(worldBatch.articles, 6)
    : [];

  return (
    <PublicShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Сувениры</h1>
          <p className="text-[var(--muted)]">
            Актуальные цены и остатки в пекарне
          </p>
        </div>
        <WorldTrendsStrip articles={worldTrendArticles} />
        <ProductCatalog
          products={products}
          newProducts={newProducts}
          popularProducts={popularProducts}
        />
        <LocationBlock />
        <FeedbackForm />
      </div>
    </PublicShell>
  );
}
