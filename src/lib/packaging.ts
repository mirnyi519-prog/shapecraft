import type { ProductSpecsInput } from "@/lib/product-specs";

/** Коды типов упаковки (совпадают с seed). */
export const PACKAGING_CODES = ["mini", "standard", "fragile", "long"] as const;
export type PackagingCode = (typeof PACKAGING_CODES)[number];

export function isPackagingCode(value: unknown): value is PackagingCode {
  return (
    typeof value === "string" &&
    (PACKAGING_CODES as readonly string[]).includes(value)
  );
}

export type PackagingOption = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  boxWidthMm: number | null;
  boxHeightMm: number | null;
  boxDepthMm: number | null;
  stock: number;
  sortOrder: number;
  active: boolean;
  productCount?: number;
};

/**
 * Автоподбор типа упаковки по габаритам/весу.
 * Витрине не отдаём — только админка.
 */
export function suggestPackagingCode(
  specs: ProductSpecsInput,
): PackagingCode {
  const dims = [specs.widthMm, specs.heightMm, specs.depthMm]
    .filter((value): value is number => value != null && Number.isFinite(value) && value > 0)
    .map((value) => value);

  const maxDim = dims.length > 0 ? Math.max(...dims) : 0;
  const weight =
    specs.weightGrams != null && Number.isFinite(specs.weightGrams)
      ? specs.weightGrams
      : null;

  // Длинный шарнир / развёрнутая фигура
  if (maxDim >= 300) {
    return "long";
  }

  // Кликеры, брелоки, темляки
  if (maxDim > 0 && maxDim <= 60) {
    return "mini";
  }

  // Лёгкое ажурное / хрупкое в среднем размере
  if (
    maxDim >= 90 &&
    maxDim <= 160 &&
    weight != null &&
    weight > 0 &&
    weight < 55
  ) {
    return "fragile";
  }

  // Чиби и прочие фигурки; без габаритов — стандарт по умолчанию
  return "standard";
}

export function formatPackagingBoxSize(packaging: {
  boxWidthMm: number | null;
  boxHeightMm: number | null;
  boxDepthMm: number | null;
}): string | null {
  const parts = [
    packaging.boxWidthMm,
    packaging.boxHeightMm,
    packaging.boxDepthMm,
  ].filter((value): value is number => value != null && Number.isFinite(value));

  if (parts.length === 0) {
    return null;
  }

  return `${[packaging.boxWidthMm, packaging.boxHeightMm, packaging.boxDepthMm]
    .map((value) =>
      value == null || !Number.isFinite(value) ? "—" : String(Math.round(value)),
    )
    .join("×")} мм`;
}

export function packagingRecommendHint(code: PackagingCode): string {
  switch (code) {
    case "mini":
      return "Маленькие кликеры, брелоки, темляки (до ~60 мм).";
    case "standard":
      return "Чиби-фигурки вроде Джейсона (~10–14 см). Короб 150×100×100 + пупырка.";
    case "fragile":
      return "Ажур / хрупкое, лёгкое (коза и похожие). Мягкое гнездо, без сжатия.";
    case "long":
      return "Длинные шарнирные (дракон и т.п.). Свернуть и короб ~200–250 мм.";
    default:
      return "";
  }
}
