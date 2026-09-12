import Link from "next/link";
import { redirect } from "next/navigation";
import { PricePrintClient } from "@/components/price-print-client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function PricePrintPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?next=/dashboard/price-print");
  }

  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      imageUrl: true,
      listPrice: true,
      stock: true,
    },
  });

  return (
    <div className="min-h-screen bg-white text-[var(--text)]">
      <div className="border-b border-[var(--border)] bg-[var(--bg)] px-4 py-3">
        <div className="mx-auto flex max-w-4xl flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-[var(--muted)]">ShapeCraft</p>
              <h1 className="text-lg font-semibold">Прайс для печати</h1>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium"
            >
              Назад
            </Link>
          </div>

          <PricePrintClient products={products} />

          <div className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs text-[var(--muted)] sm:text-sm">
            <p className="font-medium text-[var(--text)]">Печать с телефона</p>
            <ol className="mt-1 list-decimal space-y-1 pl-4">
              <li>
                Нажмите{" "}
                <span className="font-medium text-[var(--text)]">Открыть PDF</span>
                .
              </li>
              <li>В PDF нажмите кнопку «Поделиться» (квадрат со стрелкой).</li>
              <li>Выберите «Печать».</li>
            </ol>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-5">
        <div className="mb-4">
          <h2 className="text-xl font-bold">ShapeCraft — прайс</h2>
          <p className="text-sm text-[var(--muted)]">
            {new Intl.DateTimeFormat("ru-RU", {
              day: "numeric",
              month: "long",
              year: "numeric",
            }).format(new Date())}{" "}
            · {products.length} поз. · предпросмотр
          </p>
        </div>

        {products.length === 0 ? (
          <p className="text-[var(--muted)]">Нет активных товаров.</p>
        ) : (
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b-2 border-[var(--border)] text-[var(--muted)]">
                <th className="py-2 pr-2 font-medium">Фото</th>
                <th className="py-2 pr-2 font-medium">Название</th>
                <th className="py-2 pl-2 text-right font-medium">Прайс</th>
                <th className="py-2 pl-2 text-right font-medium">Остаток</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr
                  key={product.id}
                  className="border-b border-[var(--border)] align-middle"
                >
                  <td className="py-2 pr-2">
                    {product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.imageUrl}
                        alt=""
                        width={48}
                        height={48}
                        className="h-12 w-12 rounded-md bg-[var(--brand-soft)] object-contain"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[var(--bg)] text-xs text-[var(--muted)]">
                        —
                      </div>
                    )}
                  </td>
                  <td className="py-2 pr-2 font-medium">{product.name}</td>
                  <td className="py-2 pl-2 text-right font-semibold whitespace-nowrap">
                    {product.listPrice != null && Number.isFinite(product.listPrice)
                      ? new Intl.NumberFormat("ru-RU", {
                          style: "currency",
                          currency: "RUB",
                          maximumFractionDigits: 0,
                        }).format(product.listPrice)
                      : "—"}
                  </td>
                  <td className="py-2 pl-2 text-right whitespace-nowrap">
                    {product.stock} шт
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
