import Link from "next/link";
import {
  PRODUCTS_VIEWS,
  type ProductsView,
} from "@/components/app-nav-config";
import { chromeTab } from "@/components/ui";

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
      className="chrome-tabs on-page"
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
            className={chromeTab(active)}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
