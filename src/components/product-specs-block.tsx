import { getProductSpecLines, hasProductSpecs, type ProductSpecsValues } from "@/lib/product-specs";

export function ProductSpecsBlock({
  product,
  compact = false,
}: {
  product: ProductSpecsValues;
  compact?: boolean;
}) {
  if (!hasProductSpecs(product)) {
    return compact ? null : (
      <p className="text-sm text-[var(--muted)]">Вес и габариты пока не указаны.</p>
    );
  }

  const lines = getProductSpecLines(product);

  return (
    <dl className={`grid gap-2 ${compact ? "text-sm" : ""}`}>
      {lines.map((line) => (
        <div
          key={line.label}
          className="flex items-start justify-between gap-3 rounded-xl bg-[var(--bg)] px-4 py-3"
        >
          <dt className="text-[var(--muted)]">{line.label}</dt>
          <dd className="font-medium text-right">{line.value}</dd>
        </div>
      ))}
    </dl>
  );
}
