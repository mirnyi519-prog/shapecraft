import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import {
  WorldTrendsAdmin,
  WorldTrendsView,
} from "@/components/world-trends-view";
import { getSession, isAdmin } from "@/lib/auth";
import { getWeekLabel } from "@/lib/world-trends";
import {
  getLatestWorldTrendBatchView,
} from "@/lib/world-trends-data";

export default async function WorldPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?next=/world");
  }

  if (!isAdmin(session.role)) {
    redirect("/dashboard");
  }

  const batch = await getLatestWorldTrendBatchView();
  const currentWeek = getWeekLabel();
  const imagesLoaded =
    batch?.articles.filter((item) => item.imageUrl).length ?? 0;
  const needsSync =
    !batch ||
    batch.articles.length === 0 ||
    batch.weekLabel !== currentWeek;

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">В мире</h1>
          <p className="text-[var(--muted)]">
            Еженедельная подборка актуальных сувениров для 3D-печати по миру
          </p>
        </div>

        <WorldTrendsAdmin
          lastGenerated={batch?.generatedAt ?? null}
          weekLabel={batch?.weekLabel ?? null}
          articleCount={batch?.articles.length ?? 0}
          imagesLoaded={imagesLoaded}
          needsSync={needsSync}
          currentWeek={currentWeek}
        />
        <WorldTrendsView batch={batch} />
      </div>
    </AppShell>
  );
}
