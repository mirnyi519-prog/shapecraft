export type NavIconName =
  | "store"
  | "dashboard"
  | "products"
  | "categories"
  | "banner"
  | "sales"
  | "sale-new"
  | "settlements"
  | "receipts"
  | "users"
  | "visits"
  | "feedback"
  | "security"
  | "display"
  | "world";

export type AppNavItem = {
  href: string;
  label: string;
  icon: NavIconName;
  children?: AppNavItem[];
};

export type ProductsView = "all" | "no-price" | "out" | "archive";

export const PRODUCTS_VIEWS: {
  id: ProductsView;
  label: string;
  href: string;
  adminOnly?: boolean;
}[] = [
  { id: "all", label: "Все товары", href: "/products" },
  { id: "no-price", label: "Без прайса", href: "/products?view=no-price" },
  { id: "out", label: "Нет в наличии", href: "/products?view=out" },
  {
    id: "archive",
    label: "Архив",
    href: "/products?view=archive",
    adminOnly: true,
  },
];

export function parseProductsView(value: string | null | undefined): ProductsView {
  if (value === "no-price" || value === "out" || value === "archive") {
    return value;
  }
  return "all";
}

export function productsViewTitle(view: ProductsView): string {
  return PRODUCTS_VIEWS.find((item) => item.id === view)?.label ?? "Товары";
}

export function getAppNavItems(admin: boolean): AppNavItem[] {
  const productChildren = PRODUCTS_VIEWS.filter(
    (item) => !item.adminOnly || admin,
  ).map((item) => ({
    href: item.href,
    label: item.label,
    icon: "products" as const,
  }));

  return [
    { href: "/", label: "Витрина", icon: "store" },
    { href: "/display", label: "Экран", icon: "display" },
    { href: "/dashboard", label: "Сводка", icon: "dashboard" },
    {
      href: "/products",
      label: "Товары",
      icon: "products",
      children: productChildren,
    },
    ...(admin
      ? [{ href: "/categories", label: "Разделы", icon: "categories" as const }]
      : []),
    ...(admin ? [{ href: "/banner", label: "Баннер", icon: "banner" as const }] : []),
    { href: "/sales", label: "Продажи", icon: "sales" },
    { href: "/sales/new", label: "+ Продажа", icon: "sale-new" },
    { href: "/settlements", label: "Расчёты", icon: "settlements" },
    ...(admin ? [{ href: "/receipts", label: "Приход", icon: "receipts" as const }] : []),
    ...(admin ? [{ href: "/users", label: "Пользователи", icon: "users" as const }] : []),
    ...(admin ? [{ href: "/visits", label: "Посещения", icon: "visits" as const }] : []),
    ...(admin ? [{ href: "/feedback", label: "Обратная связь", icon: "feedback" as const }] : []),
    ...(admin ? [{ href: "/world", label: "В мире", icon: "world" as const }] : []),
    ...(admin ? [{ href: "/security", label: "Безопасность", icon: "security" as const }] : []),
  ];
}

function pathAndQuery(href: string): { path: string; query: URLSearchParams } {
  const [path, queryString = ""] = href.split("?");
  return { path, query: new URLSearchParams(queryString) };
}

export function isNavItemActive(
  pathname: string,
  href: string,
  search = "",
): boolean {
  const { path, query } = pathAndQuery(href);
  const current = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);

  if (path === "/") {
    return pathname === "/";
  }

  if (path === "/sales/new") {
    return pathname === "/sales/new";
  }

  if (path === "/sales") {
    return pathname.startsWith("/sales") && !pathname.startsWith("/sales/new");
  }

  if (path === "/products" && query.has("view")) {
    return pathname === "/products" && current.get("view") === query.get("view");
  }

  if (path === "/products" && !query.has("view") && href === "/products") {
    // «Все товары» — только список без view; детали товара подсвечивают родителя
    return pathname === "/products" && !current.get("view");
  }

  return pathname === path || pathname.startsWith(`${path}/`);
}

export function isNavGroupActive(pathname: string, item: AppNavItem): boolean {
  if (item.children?.length) {
    if (item.href === "/products") {
      return pathname === "/products" || pathname.startsWith("/products/");
    }
    return item.children.some((child) => isNavItemActive(pathname, child.href));
  }
  return isNavItemActive(pathname, item.href);
}
