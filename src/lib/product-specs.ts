export type ProductSpecsInput = {
  weightGrams?: number | null;
  widthMm?: number | null;
  heightMm?: number | null;
  depthMm?: number | null;
};

export type ProductSpecsValues = {
  weightGrams: number | null;
  widthMm: number | null;
  heightMm: number | null;
  depthMm: number | null;
};

export function parseOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    return null;
  }
  return number;
}

export function hasProductSpecs(product: ProductSpecsValues): boolean {
  return (
    product.weightGrams !== null ||
    product.widthMm !== null ||
    product.heightMm !== null ||
    product.depthMm !== null
  );
}

export function formatWeightGrams(grams: number | null | undefined): string | null {
  if (grams === null || grams === undefined || !Number.isFinite(grams)) {
    return null;
  }

  if (grams >= 1000) {
    const kg = grams / 1000;
    return Number.isInteger(kg) ? `${kg} кг` : `${kg.toFixed(2).replace(/\.?0+$/, "")} кг`;
  }

  return Number.isInteger(grams)
    ? `${grams} г`
    : `${grams.toFixed(1).replace(/\.?0+$/, "")} г`;
}

export function formatDimensions(product: ProductSpecsValues): string | null {
  const { widthMm, heightMm, depthMm } = product;
  const parts = [widthMm, heightMm, depthMm].filter(
    (value): value is number => value !== null && Number.isFinite(value),
  );

  if (parts.length === 0) {
    return null;
  }

  const formatted = [widthMm, heightMm, depthMm].map((value) =>
    value === null || !Number.isFinite(value) ? "—" : String(Math.round(value)),
  );

  return `${formatted.join("×")} мм`;
}

export function getProductSpecLines(product: ProductSpecsValues): { label: string; value: string }[] {
  const lines: { label: string; value: string }[] = [];
  const weight = formatWeightGrams(product.weightGrams);
  const dimensions = formatDimensions(product);

  if (weight) {
    lines.push({ label: "Вес", value: weight });
  }
  if (dimensions) {
    lines.push({ label: "Габариты (Ш×В×Г)", value: dimensions });
  }

  return lines;
}
