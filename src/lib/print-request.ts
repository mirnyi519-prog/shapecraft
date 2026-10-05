import { normalizeHoldPhone } from "@/lib/product-holds";

export const PRINT_REQUEST_STATUSES = [
  "new",
  "printing",
  "ready",
  "cancelled",
] as const;

export type PrintRequestStatus = (typeof PRINT_REQUEST_STATUSES)[number];

export const PRINT_REQUEST_STATUS_LABELS: Record<PrintRequestStatus, string> = {
  new: "Новая",
  printing: "В печати",
  ready: "Готова",
  cancelled: "Отменена",
};

export function isPrintRequestStatus(value: string): value is PrintRequestStatus {
  return (PRINT_REQUEST_STATUSES as readonly string[]).includes(value);
}

export function parsePrintQuantity(value: unknown): number | null {
  const quantity =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
    return null;
  }
  return quantity;
}

export function parsePrintCustomerName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) {
    return null;
  }
  return name;
}

export function parsePrintPhone(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  return normalizeHoldPhone(value);
}

export function parsePrintSourceUrl(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const raw = value.trim();
  if (!raw || raw.length > 500) {
    return null;
  }
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}
