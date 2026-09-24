import Link from "next/link";
import {
  STORE_PHONE_DISPLAY,
  STORE_PHONE_TEL,
  buildWhatsAppUrl,
} from "@/lib/store-contact";
import type { PickupOpenStatus } from "@/lib/pickup-hours";

export function StorefrontHero({
  lineLabel,
  openStatus,
}: {
  lineLabel: string;
  openStatus: PickupOpenStatus;
}) {
  const openTone =
    openStatus.isOpenNow || openStatus.canPickupToday
      ? "border-[var(--brand)]/40 bg-[var(--brand-soft)] text-[var(--brand-dark)]"
      : "border-[var(--border)] bg-white/80 text-[var(--muted)]";

  return (
    <section className="space-y-5 pt-2 sm:pt-4">
      <div className="space-y-3">
        <p className="text-sm font-medium tracking-wide text-[var(--brand)]">
          shapecraft.ru
        </p>
        <h1 className="text-4xl font-bold leading-none tracking-tight text-[var(--text)] sm:text-5xl">
          ShapeCraft
        </h1>
        <p className="max-w-xl text-base text-[var(--muted)] sm:text-lg">
          3D-сувениры у Светланы — забрать в пекарне в часы работы точки.
        </p>
      </div>

      <div
        className={`inline-flex max-w-full flex-col gap-0.5 rounded-2xl border px-4 py-3 sm:flex-row sm:items-center sm:gap-3 ${openTone}`}
      >
        <span className="text-sm font-semibold">{openStatus.headline}</span>
        <span className="text-sm opacity-80">{openStatus.detail}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        <a
          href={buildWhatsAppUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#25D366] px-4 text-sm font-semibold text-white transition hover:brightness-95"
        >
          WhatsApp
        </a>
        <a
          href={`tel:${STORE_PHONE_TEL}`}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-white/80 px-4 text-sm font-medium text-[var(--text)] backdrop-blur transition hover:border-[var(--brand)]"
        >
          {STORE_PHONE_DISPLAY}
        </a>
        <Link
          href="#pickup"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-white/80 px-4 text-sm font-medium backdrop-blur transition hover:border-[var(--brand)]"
        >
          Как забрать
        </Link>
      </div>

      <p className="text-sm text-[var(--muted)]">
        Сейчас смотрите: <span className="font-medium text-[var(--text)]">{lineLabel}</span>
      </p>
    </section>
  );
}
