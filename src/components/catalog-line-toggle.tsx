import Link from "next/link";
import {
  CATALOG_LINE_LABELS,
  CATALOG_LINES,
  type CatalogLine,
} from "@/lib/catalog-line";

export function CatalogLineToggle({
  current,
  basePath = "/",
}: {
  current: CatalogLine;
  basePath?: string;
}) {
  return (
    <nav aria-label="Направление каталога">
      <div
        className="inline-flex max-w-full gap-1 overflow-x-auto rounded-full border border-[var(--border)]/80 bg-white/70 p-1 backdrop-blur [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
              className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                active
                  ? "bg-[var(--brand)] text-white"
                  : "text-[var(--muted)] hover:bg-[var(--brand-soft)] hover:text-[var(--text)]"
              }`}
            >
              {CATALOG_LINE_LABELS[line]}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
