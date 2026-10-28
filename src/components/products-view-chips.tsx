import Link from "next/link";
import {
  PRODUCTS_VIEWS,
  type ProductsView,
} from "@/components/app-nav-config";
import { viewTab } from "@/components/ui";

export function ProductsViewChips({
  view,
  isAdmin,
}: {
  view: ProductsView;
  isAdmin: boolean;
}) {
  const items = PRODUCTS_VIEWS.filter((item) => !item.adminOnly || isAdmin);

  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="tablist"
      aria-label="Фильтр товаров"
    >
      {items.map((item) => {
        const active = view === item.id;
        return (
          <Link
            key={item.id}
            href={item.href}
            role="tab"
            aria-selected={active}
            className={viewTab(active, "min-h-10")}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
