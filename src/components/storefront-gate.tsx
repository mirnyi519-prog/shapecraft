import Link from "next/link";
import { cardMediaUrl } from "@/lib/card-media-url";
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

const WORLD_HREF = "/?view=world";
const WORLD_LABEL = "В мире";
const WORLD_HINT = "Идеи сувениров, которые сейчас печатают";

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
    <div className={`h-full min-h-0 overflow-hidden rounded-2xl bg-[var(--brand-soft)] ${className}`}>
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
    <div className="gate-mosaic grid h-40 grid-cols-4 grid-rows-2 gap-1.5 sm:h-56 sm:gap-2">
      {slots.map((photo, index) => (
        <PhotoCell
          key={photo?.id ?? `slot-${index}`}
          photo={photo}
          label={index === 0 ? label : ""}
          className={index === 0 ? "col-span-2 row-span-2" : ""}
        />
      ))}
    </div>
  );
}

function GateCard({
  href,
  label,
  hint,
  photos,
  ariaLabel,
}: {
  href: string;
  label: string;
  hint: string;
  photos: GatePhoto[];
  ariaLabel: string;
}) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className="group flex h-full flex-col overflow-hidden rounded-3xl border border-[var(--border)]/70 bg-white/80 shadow-sm backdrop-blur-sm transition hover:border-[var(--brand)] hover:shadow-md"
    >
      <div className="p-3 sm:p-4">
        <PhotoMosaic photos={photos} label={label} />
      </div>
      <div className="flex flex-1 flex-col px-4 pb-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--brand)]">ShapeCraft</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">{label}</h2>
          <p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-[var(--muted)]">
            {hint}
          </p>
        </div>
        <span className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white transition group-hover:bg-[var(--brand-dark)]">
          Смотреть
        </span>
      </div>
    </Link>
  );
}

export function StorefrontGate({
  covers,
  worldPhotos,
}: {
  covers: Record<CatalogLine, GatePhoto[]>;
  worldPhotos: GatePhoto[];
}) {
  const lines: CatalogLine[] = ["souvenir", "home"];

  return (
    <section className="grid items-stretch gap-4 pt-2 sm:grid-cols-2 sm:gap-4 sm:pt-4 xl:grid-cols-3">
      {lines.map((line) => (
        <GateCard
          key={line}
          href={lineHref(line)}
          label={CATALOG_LINE_LABELS[line]}
          hint={LINE_HINTS[line]}
          photos={covers[line]}
          ariaLabel={`${CATALOG_LINE_LABELS[line]}: открыть каталог`}
        />
      ))}
      <GateCard
        href={WORLD_HREF}
        label={WORLD_LABEL}
        hint={WORLD_HINT}
        photos={worldPhotos}
        ariaLabel="В мире: открыть подборку"
      />
    </section>
  );
}
