import { DisplayAutoRefresh } from "@/components/display-auto-refresh";
import { DisplayCatalog } from "@/components/display-catalog";
import { getActiveCatalogProducts } from "@/lib/catalog-product";

export default async function DisplayPage() {
  const products = await getActiveCatalogProducts();

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <DisplayAutoRefresh />
      <DisplayCatalog products={products} />
    </div>
  );
}
