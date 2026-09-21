import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PackagingManager } from "@/components/packaging-manager";
import { getSession, isAdmin } from "@/lib/auth";
import { listPackaging } from "@/lib/packaging-data";

export default async function PackagingPage() {
  const session = await getSession();
  if (!session) {
    return null;
  }
  if (!isAdmin(session.role)) {
    redirect("/dashboard");
  }

  const items = await listPackaging(true);

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Упаковка</h1>
          <p className="text-[var(--muted)]">
            Остатки коробок и рекомендации для товаров. На витрине покупателям не
            показывается.
          </p>
        </div>
        <PackagingManager items={items} />
      </div>
    </AppShell>
  );
}
