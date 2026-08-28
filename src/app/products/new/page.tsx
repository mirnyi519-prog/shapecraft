import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui";
import { ProductForm } from "@/components/forms";
import { getSession } from "@/lib/auth";

export default async function NewProductPage() {
  const session = await getSession();
  if (!session) {
    return null;
  }

  if (session.role !== "admin") {
    redirect("/products");
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Новый товар</h1>
          <p className="text-[var(--muted)]">Карточка игрушки для учёта и продаж</p>
        </div>
        <Card>
          <ProductForm canEditCost />
        </Card>
      </div>
    </AppShell>
  );
}
