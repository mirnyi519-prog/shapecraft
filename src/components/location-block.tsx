import {
  PICKUP_MAPS_URL,
  PICKUP_MAP_WIDGET_URL,
  PICKUP_TITLE,
  STORE_PHONE_DISPLAY,
  STORE_PHONE_TEL,
  buildWhatsAppUrl,
} from "@/lib/store-contact";
import { PickupHoursPanel } from "@/components/pickup-hours-panel";

export function LocationBlock() {
  return (
    <section
      id="pickup"
      className="scroll-mt-24 overflow-hidden rounded-3xl border border-[var(--border)]/70 bg-[var(--brand-soft)]/40"
    >
      <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-5 p-5 sm:p-7">
          <div>
            <p className="text-sm font-medium text-[var(--brand)]">Точка выдачи</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">Где забрать</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)] sm:text-base">
              ShapeCraft — в пекарне «У Светланы». В часы работы часто можно
              забрать в тот же день.
            </p>
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
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-4 text-sm font-semibold text-[var(--brand)] transition hover:bg-white/90"
            >
              {STORE_PHONE_DISPLAY}
            </a>
            <a
              href={PICKUP_MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-white/80 px-4 text-sm font-medium transition hover:border-[var(--brand)]"
            >
              Маршрут
            </a>
          </div>

          <div className="rounded-2xl bg-white/80 px-4 py-3 text-sm backdrop-blur">
            <p className="font-semibold">{PICKUP_TITLE}</p>
            <p className="mt-1 text-[var(--muted)]">Яндекс.Карты · самовывоз</p>
          </div>

          <PickupHoursPanel compact />
        </div>

        <div className="relative min-h-48 border-t border-[var(--border)]/60 bg-white/50 lg:min-h-[22rem] lg:border-l lg:border-t-0">
          <iframe
            title="Карта: пекарня У Светланы"
            src={PICKUP_MAP_WIDGET_URL}
            className="absolute inset-0 h-full w-full border-0"
            loading="lazy"
            allowFullScreen
          />
        </div>
      </div>
    </section>
  );
}
