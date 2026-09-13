export const CATALOG_LINES = ["souvenir", "home"] as const;

export type CatalogLine = (typeof CATALOG_LINES)[number];

export const CATALOG_LINE_LABELS: Record<CatalogLine, string> = {
  souvenir: "Сувениры",
  home: "Для дома",
};

export function isCatalogLine(value: unknown): value is CatalogLine {
  return value === "souvenir" || value === "home";
}

export function parseCatalogLine(
  value: string | string[] | null | undefined,
  fallback: CatalogLine = "souvenir",
): CatalogLine {
  const raw = Array.isArray(value) ? value[0] : value;
  return isCatalogLine(raw) ? raw : fallback;
}
