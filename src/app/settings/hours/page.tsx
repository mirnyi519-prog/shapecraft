import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { HoursSettingsEditor } from "@/components/hours-settings-editor";
import { getSession, isAdmin } from "@/lib/auth";
import { ensureStoreSettings } from "@/lib/store-settings";

export default async function SettingsHoursPage() {
  const session = await getSession();
  if (!session) {
    return null;
  }
  if (!isAdmin(session.role)) {
    redirect("/dashboard");
  }

  const settings = await ensureStoreSettings();

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">График работы</h1>
          <p className="text-[var(--muted)]">
            Часы пекарни на витрине. Зимой по умолчанию закрытие на час раньше
            (1 ноя — 31 мар), режим и даты можно менять.
          </p>
        </div>
        <HoursSettingsEditor initial={settings} />
      </div>
    </AppShell>
  );
}
