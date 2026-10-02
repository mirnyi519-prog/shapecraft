import Link from "next/link";
import { cardMediaUrl } from "@/lib/image-variants";
import {
  CATALOG_LINE_LABELS,
  type CatalogLine,
} from "@/lib/catalog-line";

export type GatePhoto = {
  id: string;
  name: string;
  imageUrl: string;
};

const LINE_HINTS: Record<CatalogLine, string> = {
  souvenir: "Фигурки, кликеры и брелоки — забрать в пекарне",
  home: "Вещи для дома и интерьера",
};

function lineHref(line: CatalogLine): string {
  return `/?line=${line}`;
}

function PhotoCell({
  photo,
  label,
  className,
}: {
  photo: GatePhoto | null;
  label: string;
  className: string;
}) {
  const src = photo ? (cardMediaUrl(photo.imageUrl) ?? photo.imageUrl) : null;
  return (
    <div className={`overflow-hidden rounded-2xl bg-[var(--brand-soft)] ${className}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="flex h-full items-center justify-center px-2 text-center text-xs text-[var(--muted)]">
          {label}
        </div>
      )}
    </div>
  );
}

function PhotoMosaic({ photos, label }: { photos: GatePhoto[]; label: string }) {
  const slots = Array.from({ length: 5 }, (_, index) => photos[index] ?? null);

  return (
    <>
      <div className="grid grid-cols-6 gap-1.5 sm:hidden">
        {slots.map((photo, index) => (
          <PhotoCell
            key={photo?.id ?? `m-${index}`}
            photo={photo}
            label={index === 0 ? label : ""}
            className={
              index < 2 ? "col-span-3 aspect-[4/3]" : "col-span-2 aspect-square"
            }
          />
        ))}
      </div>
      <div className="gate-mosaic hidden h-56 grid-cols-4 grid-rows-2 gap-2 sm:grid">
        {slots.map((photo, index) => (
          <PhotoCell
            key={photo?.id ?? `d-${index}`}
            photo={photo}
            label={index === 0 ? label : ""}
            className={index === 0 ? "col-span-2 row-span-2" : ""}
          />
        ))}
      </div>
    </>
  );
}

export function StorefrontGate({
  covers,
}: {
  covers: Record<CatalogLine, GatePhoto[]>;
}) {
  const lines: CatalogLine[] = ["souvenir", "home"];

  return (
    <section className="grid gap-4 pt-2 sm:grid-cols-2 sm:gap-4 sm:pt-4">
      {lines.map((line) => {
        const label = CATALOG_LINE_LABELS[line];
        return (
          <Link
            key={line}
            href={lineHref(line)}
            aria-label={`${label}: открыть каталог`}
            className="group overflow-hidden rounded-3xl border border-[var(--border)]/70 bg-white/80 shadow-sm backdrop-blur-sm transition hover:border-[var(--brand)] hover:shadow-md"
          >
            <div className="p-3 sm:p-4">
              <PhotoMosaic photos={covers[line]} label={label} />
            </div>
            <div className="flex flex-col gap-3 px-4 pb-4 sm:px-4 sm:pb-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--brand)]">ShapeCraft</p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight">
                  {label}
                </h2>
                <p className="mt-1 text-sm leading-snug text-[var(--muted)]">
                  {LINE_HINTS[line]}
                </p>
              </div>
              <span className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white transition group-hover:bg-[var(--brand-dark)]">
                Смотреть
              </span>
            </div>
          </Link>
        );
      })}
    </section>
  );
}
