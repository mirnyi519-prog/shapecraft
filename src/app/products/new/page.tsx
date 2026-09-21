import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui";
import { ProductForm } from "@/components/forms";
import { getSession } from "@/lib/auth";
import { listCategoryOptions } from "@/lib/categories-data";
import { listPackaging } from "@/lib/packaging-data";

export default async function NewProductPage() {
  const session = await getSession();
  if (!session) {
    return null;
  }

  if (session.role !== "admin") {
    redirect("/products");
  }

  const [categories, packagingOptions] = await Promise.all([
    listCategoryOptions(),
    listPackaging(true),
  ]);

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Новый товар</h1>
          <p className="text-[var(--muted)]">
            Карточка товара. Упаковка подберётся по габаритам (на витрине не видна).
          </p>
        </div>
        <Card>
          <ProductForm
            canEditCost
            categories={categories.map((item) => ({ id: item.id, name: item.name }))}
            packagingOptions={packagingOptions}
          />
        </Card>
      </div>
    </AppShell>
  );
}
