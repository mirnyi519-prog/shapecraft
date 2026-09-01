import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import {
  WorldTrendsAdmin,
  WorldTrendsView,
} from "@/components/world-trends-view";
import { getSession, isAdmin } from "@/lib/auth";
import type { WorldTrendBatchView } from "@/lib/world-trends";
import { isWorldPriceTier } from "@/lib/world-trends";
import { getLatestWorldTrendBatch } from "@/lib/world-trends-bot";

function mapBatch(
  batch: NonNullable<Awaited<ReturnType<typeof getLatestWorldTrendBatch>>>,
): WorldTrendBatchView {
  return {
    id: batch.id,
    weekLabel: batch.weekLabel,
    generatedAt: batch.generatedAt.toISOString(),
    articles: batch.articles.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      imageUrl: item.imageUrl,
      sourceUrl: item.sourceUrl,
      priceTier: isWorldPriceTier(item.priceTier) ? item.priceTier : "medium",
      priceLabel: item.priceLabel,
      sortOrder: item.sortOrder,
    })),
  };
}

export default async function WorldPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?next=/world");
  }

  if (!isAdmin(session.role)) {
    redirect("/dashboard");
  }

  const latest = await getLatestWorldTrendBatch();
  const batch = latest ? mapBatch(latest) : null;

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">В мире</h1>
          <p className="text-[var(--muted)]">
            Еженедельная подборка актуальных игрушек для 3D-печати по миру
          </p>
        </div>

        <WorldTrendsAdmin lastGenerated={batch?.generatedAt ?? null} />
        <WorldTrendsView batch={batch} />
      </div>
    </AppShell>
  );
}
