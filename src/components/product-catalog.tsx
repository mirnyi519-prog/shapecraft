import { ProductPhoto } from "@/components/product-photo";
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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {products.map((product) => (
        <Card key={product.id}>
          <div className="space-y-4">
            <ProductPhoto
              src={product.imageUrl}
              alt={product.name}
              frameClassName="aspect-[4/3] h-auto min-h-44 sm:min-h-48"
            />
            <div>
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-base font-semibold sm:text-lg">{product.name}</h2>
                <Badge
                  tone={
                    product.stock === 0
                      ? "warning"
                      : product.stock <= 2
                        ? "neutral"
                        : "success"
                  }
                >
                  {product.stock === 0 ? "Нет" : `${product.stock} шт`}
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
