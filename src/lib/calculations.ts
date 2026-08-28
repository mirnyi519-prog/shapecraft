export type SaleSplit = {
  amount: number;
  costTotal: number;
  profit: number;
  ownerShare: number;
  partnerShare: number;
};

export function calculateSaleSplit(
  unitCost: number,
  quantity: number,
  saleAmount: number,
  ownerSplitPercent = 50,
): SaleSplit {
  const costTotal = unitCost * quantity;
  const profit = saleAmount - costTotal;
  const ownerShare = (profit * ownerSplitPercent) / 100;
  const partnerShare = profit - ownerShare;

  return {
    amount: saleAmount,
    costTotal,
    profit,
    ownerShare,
    partnerShare,
  };
}

export function formatRub(value: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value: Date | string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export function formatDateTime(value: Date | string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
