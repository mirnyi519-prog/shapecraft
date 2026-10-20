import { redirect } from "next/navigation";
import { AnalyticsSwitch } from "@/components/analytics-switch";
import { AppShell } from "@/components/app-shell";
import { FilamentFinder } from "@/components/filament-finder";
import { getSession, isAdmin } from "@/lib/auth";
import { getRecentFilamentQueries } from "@/lib/filament";

export default async function FilamentPage() {
  const session = await getSession();
  if (!session) {
    return null;
  }
  if (!isAdmin(session.role)) {
    redirect("/dashboard");
  }

  const recent = await getRecentFilamentQueries();

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Филамент</h1>
          <div className="mt-3">
            <AnalyticsSwitch current="filament" />
          </div>
          <p className="mt-3 text-[var(--muted)]">
            Самая низкая цена на Bambu Lab: Яндекс Маркет проверяется сам, WB и Ozon — по
            ссылке с сортировкой по цене.
          </p>
        </div>
        <FilamentFinder recent={recent} />
      </div>
    </AppShell>
  );
}
