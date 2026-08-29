/** Прайс задан и товар можно продавать */
export function hasListPrice(
  listPrice: number | null | undefined,
): listPrice is number {
  return listPrice !== null && listPrice !== undefined && Number.isFinite(listPrice);
}

export function parseOptionalPrice(
  value: unknown,
): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return null;
  }
  return n;
}
