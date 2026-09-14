import { formatDateTime, formatRub } from "@/lib/calculations";
import { moscowYmd } from "@/lib/timezone";

function csvCell(value: string | number): string {
  const text = String(value);
  if (/[",;\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildCsv(rows: (string | number)[][]): string {
  const body = rows.map((row) => row.map(csvCell).join(";")).join("\n");
  return `\uFEFF${body}`;
}

type PartnerSaleRow = {
  soldAt: Date;
  productName: string;
  quantity: number;
  amount: number;
  partnerShare: number;
  note: string | null;
};

export function buildPartnerSalesCsv(input: {
  title: string;
  sales: PartnerSaleRow[];
  totals: {
    quantity: number;
    amount: number;
    partnerShare: number;
  };
}): string {
  const rows: (string | number)[][] = [
    [input.title],
    [],
    ["Дата", "Товар", "Кол-во", "Сумма продажи", "Доля партнёра", "Комментарий"],
  ];

  for (const sale of input.sales) {
    rows.push([
      formatDateTime(sale.soldAt),
      sale.productName,
      sale.quantity,
      formatRub(sale.amount),
      formatRub(sale.partnerShare),
      sale.note?.trim() || "",
    ]);
  }

  rows.push([]);
  rows.push([
    "ИТОГО",
    "",
    input.totals.quantity,
    formatRub(input.totals.amount),
    formatRub(input.totals.partnerShare),
    "",
  ]);

  return buildCsv(rows);
}

export function partnerExportFilename(prefix: string): string {
  const { year, month, day } = moscowYmd();
  const stamp = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return `${prefix}-${stamp}.csv`;
}
