import Link from "next/link";
import {
  CATALOG_LINE_LABELS,
  CATALOG_LINES,
  type CatalogLine,
} from "@/lib/catalog-line";

const LINE_HINTS: Record<CatalogLine, string> = {
  souvenir: "Фигурки, магниты и подарки",
  home: "Декор и полезные вещи для дома",
};

export function CatalogLineToggle({
  current,
  basePath = "/",
}: {
  current: CatalogLine;
  basePath?: string;
}) {
  return (
    <nav aria-label="Направление каталога" className="space-y-2">
      <p className="text-sm font-medium text-[var(--muted)]">Выберите каталог</p>
      <div
        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
        role="tablist"
      >
        {CATALOG_LINES.map((line) => {
          const active = current === line;
          const href =
            line === "souvenir"
              ? basePath
              : `${basePath}${basePath.includes("?") ? "&" : "?"}line=${line}`;

          return (
            <Link
              key={line}
              href={href}
              role="tab"
              aria-selected={active}
              className={`rounded-2xl border-2 px-4 py-4 text-left transition sm:px-5 sm:py-5 ${
                active
                  ? "border-[var(--brand)] bg-[var(--brand)] text-white shadow-sm"
                  : "border-[var(--border)] bg-white text-[var(--text)] hover:border-[var(--brand)] hover:bg-[var(--brand-soft)]"
              }`}
            >
              <span className="block text-lg font-bold sm:text-xl">
                {CATALOG_LINE_LABELS[line]}
              </span>
              <span
                className={`mt-1 block text-sm ${
                  active ? "text-white/90" : "text-[var(--muted)]"
                }`}
              >
                {LINE_HINTS[line]}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
