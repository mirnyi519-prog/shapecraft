import {
  PICKUP_MAPS_URL,
  PICKUP_MAP_WIDGET_URL,
  PICKUP_TITLE,
  STORE_PHONE_DISPLAY,
  STORE_PHONE_HINT,
  STORE_PHONE_TEL,
  buildWhatsAppUrl,
} from "@/lib/store-contact";
import { PickupHoursPanel } from "@/components/pickup-hours-panel";

export function PickupInfo({
  compact = false,
  showMap = true,
  productName,
}: {
  compact?: boolean;
  showMap?: boolean;
  productName?: string;
}) {
  const whatsappUrl = buildWhatsAppUrl(productName);

  return (
    <div className={compact ? "space-y-4" : "space-y-5"}>
      <div>
        <h3 className="text-lg font-bold">Где забрать</h3>
        <p className="mt-2 text-sm text-[var(--muted)]">
          ShapeCraft можно купить в пекарне «У Светланы». В часы работы точки —
          часто в тот же день.
        </p>
      </div>

      <PickupHoursPanel compact={compact} />

      <div className="rounded-xl bg-[var(--bg)] px-4 py-3 text-sm">
        <p className="font-medium">{PICKUP_TITLE}</p>
        <p className="mt-1 text-[var(--muted)]">Точка выдачи на Яндекс.Картах</p>
      </div>

      <a
        href={PICKUP_MAPS_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium transition hover:border-[var(--brand)] hover:bg-[var(--brand-soft)] sm:w-auto"
      >
        Открыть в Яндекс.Картах
      </a>

      {showMap ? (
        <div className="relative min-h-48 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)]">
          <iframe
            title="Карта: пекарня У Светланы"
            src={PICKUP_MAP_WIDGET_URL}
            className="absolute inset-0 h-full w-full border-0"
            loading="lazy"
            allowFullScreen
          />
        </div>
      ) : null}

      <div className="rounded-xl border border-[var(--brand)] bg-[var(--brand-soft)] px-4 py-4">
        <p className="text-sm font-medium text-[var(--brand-dark)]">Связаться</p>
        <p className="mt-1 text-sm text-[var(--text)]">{STORE_PHONE_HINT}</p>
        <a
          href={`tel:${STORE_PHONE_TEL}`}
          className="mt-3 inline-flex min-h-11 items-center text-xl font-bold text-[var(--brand)] underline-offset-4 hover:underline"
        >
          {STORE_PHONE_DISPLAY}
        </a>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-95 sm:w-auto"
        >
          Написать в WhatsApp
        </a>
      </div>
    </div>
  );
}
