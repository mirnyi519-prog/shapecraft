import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Badge, Button, Card } from "@/components/ui";
import { ProductForm } from "@/components/forms";
import { formatDateTime, formatRub } from "@/lib/calculations";
import { getSession } from "@/lib/auth";
import { hasListPrice } from "@/lib/pricing";
import { prisma } from "@/lib/db";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProductDetailPage({ params }: PageProps) {
  const session = await getSession();
  if (!session) {
    return null;
  }

  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      sales: {
        orderBy: { soldAt: "desc" },
        take: 10,
      },
      priceHistory: {
        orderBy: { changedAt: "desc" },
        take: 30,
      },
    },
  });

  if (!product) {
    notFound();
  }

  if (session.role !== "admin") {
    redirect("/products");
  }

  const priced = hasListPrice(product.listPrice);

  return (
    <AppShell>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/products" className="text-sm text-[var(--muted)] hover:underline">
            ← К товарам
          </Link>
          <h1 className="mt-1 text-2xl font-bold">{product.name}</h1>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href={`/products/${product.id}/receipt`}>
            <Button variant="secondary" className="min-h-11 w-full sm:w-auto">
              Поставка
            </Button>
          </Link>
          {priced && product.stock > 0 ? (
            <Link href={`/products/${product.id}/sale`}>
              <Button className="min-h-11 w-full sm:w-auto">Продажа</Button>
            </Link>
          ) : (
            <Button className="min-h-11 w-full sm:w-auto" disabled>
              Продажа
            </Button>
          )}
        </div>
      </div>

      {!priced ? (
        <p className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          У товара нет цены в прайсе — карточка выделена красным, продажа недоступна.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card
          title="Редактирование"
          className={priced ? "" : "border-red-400 bg-red-50/40"}
        >
          <ProductForm
            canEditCost
            initial={{
              id: product.id,
              name: product.name,
              description: product.description ?? "",
              imageUrl: product.imageUrl ?? "",
              costPrice: String(product.costPrice),
              listPrice:
                product.listPrice === null || product.listPrice === undefined
                  ? ""
                  : String(product.listPrice),
              stock: String(product.stock),
            }}
          />
        </Card>

        <div className="space-y-6">
          <Card title="История прайса">
            <div className="mb-4">
              <Badge tone={product.stock <= 2 ? "warning" : "success"}>
                Остаток: {product.stock} шт
              </Badge>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Текущий прайс:{" "}
                {priced ? formatRub(product.listPrice as number) : "не задан"}
              </p>
            </div>
            {product.priceHistory.length === 0 ? (
              <p className="text-[var(--muted)]">Изменений прайса пока нет.</p>
            ) : (
              <div className="space-y-3">
                {product.priceHistory.map((row) => {
                  const oldP = row.oldPrice;
                  const newP = row.newPrice;
                  let deltaLabel = "установка";
                  let tone = "text-[var(--muted)]";
                  if (oldP != null && newP != null) {
                    if (newP > oldP) {
                      deltaLabel = `↑ +${formatRub(newP - oldP)}`;
                      tone = "text-green-700";
                    } else if (newP < oldP) {
                      deltaLabel = `↓ −${formatRub(oldP - newP)}`;
                      tone = "text-red-700";
                    } else {
                      deltaLabel = "без изменения";
                    }
                  } else if (oldP != null && newP == null) {
                    deltaLabel = "цена снята";
                    tone = "text-red-700";
                  } else if (oldP == null && newP != null) {
                    deltaLabel = "цена задана";
                    tone = "text-green-700";
                  }

                  return (
                    <div
                      key={row.id}
                      className="rounded-xl bg-[var(--bg)] px-4 py-3 text-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span>{formatDateTime(row.changedAt)}</span>
                        <span className={`font-medium ${tone}`}>{deltaLabel}</span>
                      </div>
                      <p className="mt-1 text-[var(--muted)]">
                        {oldP == null ? "—" : formatRub(oldP)} →{" "}
                        {newP == null ? "—" : formatRub(newP)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card title="Последние продажи">
            {product.sales.length === 0 ? (
              <p className="text-[var(--muted)]">Продаж пока нет.</p>
            ) : (
              <div className="space-y-3">
                {product.sales.map((sale) => (
                  <div
                    key={sale.id}
                    className="rounded-xl bg-[var(--bg)] px-4 py-3 text-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span>{formatDateTime(sale.soldAt)}</span>
                      <span className="font-semibold">{formatRub(sale.amount)}</span>
                    </div>
                    <p className="mt-1 text-[var(--muted)]">
                      {sale.quantity} шт · прибыль {formatRub(sale.profit)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
