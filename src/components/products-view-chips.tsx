import Link from "next/link";
import {
  PRODUCTS_VIEWS,
  type ProductsView,
} from "@/components/app-nav-config";

const CHIP_STYLES: Record<
  ProductsView,
  { active: string; idle: string }
> = {
  all: {
    active: "bg-[var(--brand)] text-white shadow-sm",
    idle: "border border-[var(--border)] bg-white text-[var(--text)] hover:bg-[var(--bg)]",
  },
  "no-price": {
    active: "bg-red-600 text-white shadow-sm",
    idle: "border border-red-200 bg-red-50 text-red-800 hover:bg-red-100",
  },
  out: {
    active: "bg-amber-500 text-white shadow-sm",
    idle: "border border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100",
  },
  archive: {
    active: "bg-slate-700 text-white shadow-sm",
    idle: "border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200",
  },
};

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
        const styles = CHIP_STYLES[item.id];
        return (
          <Link
            key={item.id}
            href={item.href}
            role="tab"
            aria-selected={active}
            className={`shrink-0 rounded-full px-3.5 py-2.5 text-sm font-semibold transition ${
              active ? styles.active : styles.idle
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
