import Link from "next/link";
import { ProductPhoto } from "@/components/product-photo";
import { Badge, Button, Card } from "@/components/ui";
import { formatRub } from "@/lib/calculations";
import { hasListPrice } from "@/lib/pricing";

export type ProductCardData = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  listPrice: number | null;
  costPrice: number;
  stock: number;
};

export function ProductAdminCard({
  product,
  isAdmin,
}: {
  product: ProductCardData;
  isAdmin: boolean;
}) {
  const priced = hasListPrice(product.listPrice);

  return (
    <Card
      className={
        priced
          ? ""
          : "border-red-400 bg-red-50 ring-1 ring-red-200"
      }
    >
      <div className="space-y-4">
        <Link href={`/products/${product.id}`} className="block">
          <ProductPhoto
            src={product.imageUrl}
            alt={product.name}
            frameClassName="aspect-[4/3] h-auto min-h-40"
          />
        </Link>
        <div>
          <div className="flex items-start justify-between gap-3">
            <Link href={`/products/${product.id}`}>
              <h2 className="text-lg font-semibold hover:text-[var(--brand)]">
                {product.name}
              </h2>
            </Link>
            <Badge tone={product.stock <= 2 ? "warning" : "success"}>
              {product.stock} шт
            </Badge>
          </div>
          {!priced ? (
            <p className="mt-2 text-sm font-medium text-red-700">
              Нет цены в прайсе — продажа недоступна
            </p>
          ) : (
            <p className="mt-2 text-sm text-[var(--muted)]">
              Прайс {formatRub(product.listPrice as number)}
              {isAdmin ? ` · себестоимость ${formatRub(product.costPrice)}` : ""}
            </p>
          )}
          {product.description ? (
            <p className="mt-2 line-clamp-2 text-sm text-[var(--muted)]">
              {product.description}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {isAdmin ? (
            <Link href={`/products/${product.id}/receipt`} className="flex-1">
              <Button type="button" variant="secondary" className="min-h-11 w-full">
                Поставка
              </Button>
            </Link>
          ) : null}
          {priced ? (
            <Link href={`/products/${product.id}/sale`} className="flex-1">
              <Button type="button" className="min-h-11 w-full">
                Продажа
              </Button>
            </Link>
          ) : (
            <Button type="button" className="min-h-11 flex-1" disabled>
              Продажа
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
