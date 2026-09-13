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
    <div
      className="inline-flex rounded-full border border-[var(--border)] bg-white p-1"
      role="tablist"
      aria-label="Направление каталога"
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
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              active
                ? "bg-[var(--brand)] text-white"
                : "text-[var(--text)] hover:bg-[var(--bg)]"
            }`}
          >
            {CATALOG_LINE_LABELS[line]}
          </Link>
        );
      })}
    </div>
  );
}
