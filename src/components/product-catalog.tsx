import Image from "next/image";
import { Badge, Card } from "@/components/ui";
import { formatRub } from "@/lib/calculations";

type CatalogProduct = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  listPrice: number;
  stock: number;
  costPrice?: number;
};

export function ProductCatalog({
  products,
  showCost = false,
}: {
  products: CatalogProduct[];
  showCost?: boolean;
}) {
  if (products.length === 0) {
    return (
      <Card>
        <p className="text-[var(--muted)]">Каталог пока пуст — скоро появятся новые игрушки.</p>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {products.map((product) => (
        <Card key={product.id}>
          <div className="space-y-4">
            <div className="relative h-48 overflow-hidden rounded-xl bg-[var(--bg)]">
              {product.imageUrl ? (
                <Image
                  src={product.imageUrl}
                  alt={product.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-[var(--muted)]">
                  Нет фото
                </div>
              )}
            </div>
            <div>
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold">{product.name}</h2>
                <Badge tone={product.stock === 0 ? "warning" : product.stock <= 2 ? "neutral" : "success"}>
                  {product.stock === 0 ? "Нет в наличии" : `${product.stock} шт`}
                </Badge>
              </div>
              {product.description ? (
                <p className="mt-2 text-sm text-[var(--muted)] line-clamp-2">
                  {product.description}
                </p>
              ) : null}
              <p className="mt-3 text-xl font-bold text-[var(--brand)]">
                {formatRub(product.listPrice)}
              </p>
              {showCost && product.costPrice !== undefined ? (
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Себестоимость {formatRub(product.costPrice)}
                </p>
              ) : null}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
