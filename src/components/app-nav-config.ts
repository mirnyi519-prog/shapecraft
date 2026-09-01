export type NavIconName =
  | "store"
  | "dashboard"
  | "products"
  | "sales"
  | "sale-new"
  | "settlements"
  | "receipts"
  | "users"
  | "visits"
  | "feedback"
  | "security";

export type AppNavItem = {
  href: string;
  label: string;
  icon: NavIconName;
};

export function getAppNavItems(admin: boolean): AppNavItem[] {
  return [
    { href: "/", label: "Витрина", icon: "store" },
    { href: "/dashboard", label: "Сводка", icon: "dashboard" },
    { href: "/products", label: "Товары", icon: "products" },
    { href: "/sales", label: "Продажи", icon: "sales" },
    { href: "/sales/new", label: "+ Продажа", icon: "sale-new" },
    { href: "/settlements", label: "Расчёты", icon: "settlements" },
    ...(admin ? [{ href: "/receipts", label: "Приход", icon: "receipts" as const }] : []),
    ...(admin ? [{ href: "/users", label: "Пользователи", icon: "users" as const }] : []),
    ...(admin ? [{ href: "/visits", label: "Посещения", icon: "visits" as const }] : []),
    ...(admin ? [{ href: "/feedback", label: "Обратная связь", icon: "feedback" as const }] : []),
    ...(admin ? [{ href: "/security", label: "Безопасность", icon: "security" as const }] : []),
  ];
}

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }

  if (href === "/sales/new") {
    return pathname === "/sales/new";
  }

  if (href === "/sales") {
    return pathname.startsWith("/sales") && !pathname.startsWith("/sales/new");
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
