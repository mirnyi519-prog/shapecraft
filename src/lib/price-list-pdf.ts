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

function absoluteUrl(src: string): string {
  if (/^https?:\/\//i.test(src)) {
    return src;
  }
  return new URL(src, window.location.origin).toString();
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(fallback);
      }
    }, ms);
    promise
      .then((value) => {
        if (!settled) {
          settled = true;
          window.clearTimeout(timer);
          resolve(value);
        }
      })
      .catch(() => {
        if (!settled) {
          settled = true;
          window.clearTimeout(timer);
          resolve(fallback);
        }
      });
  });
}

async function loadThumbDataUrl(src: string | null): Promise<string | null> {
  if (!src) {
    return null;
  }

  const work = async (): Promise<string | null> => {
    const response = await fetch(absoluteUrl(src), {
      credentials: "same-origin",
      cache: "force-cache",
    });
    if (!response.ok) {
      return null;
    }
    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) {
      return null;
    }

    const bitmap = await createImageBitmap(blob);
    try {
      const size = 48;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return null;
      }
      ctx.fillStyle = "#fff3eb";
      ctx.fillRect(0, 0, size, size);
      const scale = Math.min(size / bitmap.width, size / bitmap.height);
      const w = bitmap.width * scale;
      const h = bitmap.height * scale;
      ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h);
      return canvas.toDataURL("image/jpeg", 0.7);
    } finally {
      bitmap.close();
    }
  };

  return withTimeout(work(), 1500, null);
}

async function loadThumbsInBatches(
  products: PricePdfProduct[],
  concurrency = 4,
): Promise<(string | null)[]> {
  const results: (string | null)[] = Array.from(
    { length: products.length },
    () => null,
  );
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < products.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await loadThumbDataUrl(products[index]?.imageUrl ?? null);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(products.length, 1)) },
    () => worker(),
  );

  // Общий лимит: не ждём картинки дольше 8 сек — PDF уйдёт с тем, что успело.
  await withTimeout(Promise.all(workers).then(() => null), 8000, null);
  return results;
}

async function buildDocDefinition(
  products: PricePdfProduct[],
): Promise<TDocumentDefinitions> {
  const dateLabel = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  const thumbs = await loadThumbsInBatches(products);

  const tableBody: Content[][] = [
    [
      { text: "Фото", style: "tableHeader", alignment: "center" },
      { text: "Название", style: "tableHeader" },
      { text: "Прайс", style: "tableHeader", alignment: "right" },
      { text: "Остаток", style: "tableHeader", alignment: "right" },
    ],
  ];

  products.forEach((product, index) => {
    const thumb = thumbs[index];
    tableBody.push([
      thumb
        ? { image: thumb, width: 28, height: 28, alignment: "center" }
        : { text: "—", alignment: "center", color: "#808081", fontSize: 9 },
      { text: product.name, margin: [0, 8, 0, 0] },
      {
        text: formatPrice(product.listPrice),
        alignment: "right",
        bold: true,
        margin: [0, 8, 0, 0],
      },
      {
        text: `${product.stock} шт`,
        alignment: "right",
        margin: [0, 8, 0, 0],
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
          widths: [36, "*", 72, 48],
          body: tableBody,
        },
        layout: {
          hLineWidth: (i, node) =>
            i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.5,
          vLineWidth: () => 0,
          hLineColor: () => "#d1d5db",
          paddingLeft: () => 4,
          paddingRight: () => 4,
          paddingTop: () => 5,
          paddingBottom: () => 5,
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
  const doc = await buildDocDefinition(products);
  const pdf = pdfMake.createPdf(doc);

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
