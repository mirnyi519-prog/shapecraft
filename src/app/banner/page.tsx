import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { BannerEditor } from "@/components/banner-editor";
import { getSession, isAdmin } from "@/lib/auth";
import { getStoreBannerAdmin } from "@/lib/banner";

export default async function BannerPage() {
  const session = await getSession();
  if (!session) {
    return null;
  }

  if (!isAdmin(session.role)) {
    redirect("/dashboard");
  }

  const banner = await getStoreBannerAdmin();

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Баннер витрины</h1>
          <p className="text-[var(--muted)]">
            Текст и картинка сверху на витрине. Можно показать или убрать в любой
            момент.
          </p>
        </div>
        <BannerEditor initial={banner} />
      </div>
    </AppShell>
  );
}
