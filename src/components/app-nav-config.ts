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
  | "packaging"
  | "users"
  | "visits"
  | "views"
  | "feedback"
  | "print"
  | "security"
  | "display"
  | "world"
  | "orders"
  | "settings"
  | "hours"
  | "other"
  | "hunting"
  | "law"
  | "ammo";

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

  const mainChildren: AppNavItem[] = [
    { href: "/dashboard", label: "Сводка", icon: "dashboard" },
    {
      href: "/products",
      label: "Товары",
      icon: "products",
      children: productChildren,
    },
    { href: "/sales", label: "Продажи", icon: "sales" },
  ];
  if (admin) {
    mainChildren.push(
      { href: "/receipts", label: "Приход", icon: "receipts" },
      { href: "/delivery-orders", label: "Заказы СДЭК", icon: "orders" },
      { href: "/print-requests", label: "Печать", icon: "print" },
    );
  }

  const showcaseChildren: AppNavItem[] = [
    { href: "/", label: "Открыть витрину", icon: "store" },
    { href: "/display", label: "Экран", icon: "display" },
  ];
  if (admin) {
    showcaseChildren.push(
      { href: "/settings/banner", label: "Баннер", icon: "banner" },
      { href: "/settings/categories", label: "Разделы", icon: "categories" },
      { href: "/settings/hours", label: "График", icon: "hours" },
      { href: "/settings/world", label: "В мире", icon: "world" },
    );
  }

  const items: AppNavItem[] = [
    {
      href: "/dashboard",
      label: "Основное",
      icon: "dashboard",
      children: mainChildren,
    },
    { href: "/settlements", label: "Расчёты", icon: "settlements" },
    {
      href: "/",
      label: "Витрина",
      icon: "store",
      children: showcaseChildren,
    },
  ];

  if (admin) {
    items.push({
      href: "/settings",
      label: "Контроль",
      icon: "settings",
      children: [
        { href: "/users", label: "Пользователи", icon: "users" },
        { href: "/visits", label: "Аналитика", icon: "visits" },
        { href: "/feedback", label: "Обратная связь", icon: "feedback" },
        { href: "/packaging", label: "Упаковка", icon: "packaging" },
        { href: "/settings/security", label: "Безопасность", icon: "security" },
        { href: "/settings/orders", label: "Режим заказов", icon: "orders" },
      ],
    });
    items.push({
      href: "/other",
      label: "Иное",
      icon: "other",
      children: [
        { href: "/other/hunting", label: "Охота · Шатура", icon: "hunting" },
        { href: "/other/ammo", label: "Патроны", icon: "ammo" },
        { href: "/other/laws", label: "Закон", icon: "law" },
      ],
    });
  }

  return items;
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

  if (path === "/settings") {
    return pathname === "/settings";
  }

  return pathname === path || pathname.startsWith(`${path}/`);
}

export function isNavGroupActive(
  pathname: string,
  item: AppNavItem,
  search = "",
): boolean {
  if (
    item.href === "/products" &&
    (pathname === "/products" || pathname.startsWith("/products/"))
  ) {
    return true;
  }
  if (
    item.href === "/visits" &&
    (pathname === "/visits" ||
      pathname === "/views" ||
      pathname.startsWith("/views/") ||
      pathname === "/filament")
  ) {
    return true;
  }
  if (item.children?.some((child) => isNavGroupActive(pathname, child, search))) {
    return true;
  }
  return isNavItemActive(pathname, item.href, search);
}
