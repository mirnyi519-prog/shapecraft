import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CategoriesManager } from "@/components/categories-manager";
import { getSession, isAdmin } from "@/lib/auth";
import { listAdminCategories } from "@/lib/categories-data";

export default async function CategoriesPage() {
  const session = await getSession();
  if (!session) {
    return null;
  }

  if (!isAdmin(session.role)) {
    redirect("/dashboard");
  }

  const categories = await listAdminCategories();

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Разделы витрины</h1>
          <p className="text-[var(--muted)]">
            Справочник для фильтра на витрине. У одного сувенира может быть несколько
            разделов.
          </p>
        </div>
        <CategoriesManager categories={categories} />
      </div>
    </AppShell>
  );
}
