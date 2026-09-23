import {
  PICKUP_MAPS_URL,
  PICKUP_MAP_WIDGET_URL,
  PICKUP_TITLE,
} from "@/lib/store-contact";
import { PickupHoursPanel } from "@/components/pickup-hours-panel";

export function LocationBlock() {
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
      <div className="grid gap-0 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-4 p-5 sm:p-6">
          <div>
            <h2 className="text-xl font-bold">Где забрать</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              ShapeCraft — в пекарне «У Светланы». Можно забрать в часы работы
              точки: посмотрите статус ниже и постройте маршрут на карте.
            </p>
          </div>

          <PickupHoursPanel />

          <div className="rounded-xl bg-[var(--bg)] px-4 py-3 text-sm">
            <p className="font-medium">{PICKUP_TITLE}</p>
            <p className="mt-1 text-[var(--muted)]">
              Точка выдачи на Яндекс.Картах
            </p>
          </div>
          <a
            href={PICKUP_MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--brand-dark)] sm:w-auto"
          >
            Открыть в Яндекс.Картах
          </a>
        </div>
        <div className="relative min-h-56 border-t border-[var(--border)] bg-[var(--bg)] lg:min-h-full lg:border-l lg:border-t-0">
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
