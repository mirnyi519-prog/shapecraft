import type { UserRole } from "@/lib/auth";

/** Доля текущего пользователя */
export function selfShareLabel(role: UserRole): string {
  return role === "admin" ? "Поставщику" : "Ваша доля";
}

/** Доля второй стороны */
export function otherShareLabel(role: UserRole): string {
  return role === "admin" ? "Партнёру" : "Поставщику";
}

/** Короткая подпись для строки продажи */
export function saleShareHint(role: UserRole, amount: string): string {
  return `${selfShareLabel(role).toLowerCase()} ${amount}`;
}

/** Подписи в истории расчётов */
export function settlementShareLines(ownerShare: string, partnerShare: string) {
  return {
    supplier: `поставщику ${ownerShare}`,
    partner: `партнёру ${partnerShare}`,
  };
}

export function roleLabel(role: string): string {
  if (role === "admin") return "Админ";
  if (role === "partner") return "Партнёр";
  return role;
}
