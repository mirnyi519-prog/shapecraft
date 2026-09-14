export const BUY_CLICK_OUTCOMES = [
  "called",
  "agreed",
  "bought",
  "refused",
  "no_answer",
] as const;

export type BuyClickOutcome = (typeof BUY_CLICK_OUTCOMES)[number];

export const BUY_CLICK_OUTCOME_LABELS: Record<BuyClickOutcome, string> = {
  called: "Позвонил",
  agreed: "Договорились",
  bought: "Купил",
  refused: "Отказ",
  no_answer: "Не взял трубку",
};

export function isBuyClickOutcome(value: unknown): value is BuyClickOutcome {
  return (
    typeof value === "string" &&
    (BUY_CLICK_OUTCOMES as readonly string[]).includes(value)
  );
}

export const ZERO_STOCK_MODES = ["soon", "show", "hide"] as const;

export type ZeroStockMode = (typeof ZERO_STOCK_MODES)[number];

export const ZERO_STOCK_MODE_LABELS: Record<ZeroStockMode, string> = {
  soon: "Скоро",
  show: "Показать «нет»",
  hide: "Скрыть с витрины",
};

export const ZERO_STOCK_MODE_HINTS: Record<ZeroStockMode, string> = {
  soon: "На витрине бейдж «Скоро», можно нажать «Купить»",
  show: "Виден с «Нет в наличии», можно написать/позвонить",
  hide: "Пока остаток 0 — на витрине не показывать",
};

export function isZeroStockMode(value: unknown): value is ZeroStockMode {
  return (
    typeof value === "string" &&
    (ZERO_STOCK_MODES as readonly string[]).includes(value)
  );
}

export function parseZeroStockMode(
  value: unknown,
  fallback: ZeroStockMode = "soon",
): ZeroStockMode {
  return isZeroStockMode(value) ? value : fallback;
}
