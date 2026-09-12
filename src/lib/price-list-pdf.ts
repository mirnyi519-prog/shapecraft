import type { TDocumentDefinitions, Content } from "pdfmake/interfaces";

export type PricePdfProduct = {
  name: string;
  imageUrl: string | null;
  listPrice: number | null;
  stock: number;
};

function formatPrice(listPrice: number | null): string {
  if (listPrice == null || !Number.isFinite(listPrice)) {
    return "—";
  }
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(listPrice);
}

function fileName(): string {
  const stamp = new Intl.DateTimeFormat("sv-SE").format(new Date());
  return `shapecraft-price-${stamp}.pdf`;
}

function buildDocDefinition(products: PricePdfProduct[]): TDocumentDefinitions {
  const dateLabel = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  // Без картинок: на телефоне загрузка фото подвешивала генерацию.
  const tableBody: Content[][] = [
    [
      { text: "№", style: "tableHeader", alignment: "center" },
      { text: "Название", style: "tableHeader" },
      { text: "Прайс", style: "tableHeader", alignment: "right" },
      { text: "Остаток", style: "tableHeader", alignment: "right" },
    ],
  ];

  products.forEach((product, index) => {
    tableBody.push([
      { text: String(index + 1), alignment: "center" },
      { text: product.name },
      {
        text: formatPrice(product.listPrice),
        alignment: "right",
        bold: true,
      },
      {
        text: `${product.stock} шт`,
        alignment: "right",
      },
    ]);
  });

  return {
    pageSize: "A4",
    pageMargins: [24, 28, 24, 28],
    defaultStyle: {
      font: "Roboto",
      fontSize: 10,
      color: "#1f2937",
    },
    styles: {
      title: { fontSize: 16, bold: true, margin: [0, 0, 0, 4] },
      meta: { fontSize: 10, color: "#808081", margin: [0, 0, 0, 14] },
      tableHeader: { bold: true, color: "#808081", fontSize: 9 },
    },
    content: [
      { text: "ShapeCraft — прайс", style: "title" },
      {
        text: `${dateLabel} · ${products.length} поз.`,
        style: "meta",
      },
      {
        table: {
          headerRows: 1,
          widths: [28, "*", 72, 48],
          body: tableBody,
        },
        layout: {
          hLineWidth: (i, node) =>
            i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.5,
          vLineWidth: () => 0,
          hLineColor: () => "#d1d5db",
          paddingLeft: () => 4,
          paddingRight: () => 4,
          paddingTop: () => 6,
          paddingBottom: () => 6,
        },
      },
    ],
  };
}

async function getPdfMake() {
  const pdfMakeModule = await import("pdfmake/build/pdfmake");
  const vfsFonts = await import("pdfmake/build/vfs_fonts");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfMake: any = (pdfMakeModule as any).default ?? pdfMakeModule;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vfs = (vfsFonts as any).default ?? vfsFonts;
  pdfMake.vfs = vfs;
  return pdfMake;
}

async function createPdfBlob(products: PricePdfProduct[]): Promise<Blob> {
  const pdfMake = await getPdfMake();
  const doc = buildDocDefinition(products);
  const pdf = pdfMake.createPdf(doc);

  // В актуальном pdfmake getBlob() возвращает Promise.
  // Старый код ждал только callback — на телефоне это давало вечный «Готовим PDF».
  const result = pdf.getBlob();
  if (result && typeof result.then === "function") {
    return (await result) as Blob;
  }

  return await new Promise<Blob>((resolve, reject) => {
    try {
      pdf.getBlob((blob: Blob) => resolve(blob));
    } catch (error) {
      reject(error);
    }
  });
}

function deliverBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, "_blank");

  if (!opened) {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function openPriceListPdf(
  products: PricePdfProduct[],
): Promise<void> {
  const blob = await createPdfBlob(products);
  deliverBlob(blob, fileName());
}

export async function shareOrOpenPriceListPdf(
  products: PricePdfProduct[],
): Promise<"shared" | "opened"> {
  const blob = await createPdfBlob(products);
  const name = fileName();
  const file = new File([blob], name, { type: "application/pdf" });

  if (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({
        files: [file],
        title: "Прайс ShapeCraft",
        text: "Прайс-лист ShapeCraft",
      });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return "shared";
      }
    }
  }

  deliverBlob(blob, name);
  return "opened";
}
