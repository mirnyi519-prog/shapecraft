import Link from "next/link";
import { redirect } from "next/navigation";
import { QrPrintClient } from "@/components/qr-print-client";
import { getSession } from "@/lib/auth";
import { getPublicSiteUrl } from "@/lib/telegram";

export default async function QrPrintPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?next=/dashboard/qr-print");
  }

  const siteUrl = getPublicSiteUrl();

  return (
    <div className="min-h-screen bg-white text-[var(--text)]">
      <div className="border-b border-[var(--border)] bg-[var(--bg)] px-4 py-3">
        <div className="mx-auto flex max-w-4xl flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-[var(--muted)]">ShapeCraft</p>
              <h1 className="text-lg font-semibold">QR-код для печати</h1>
              <p className="mt-1 text-sm text-[var(--muted)]">
                В коде ссылка на {siteUrl}. В центре — знак бренда.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium"
            >
              Назад
            </Link>
          </div>
          <QrPrintClient siteUrl={siteUrl} />
        </div>
      </div>
    </div>
  );
}
