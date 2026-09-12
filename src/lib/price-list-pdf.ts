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

function absoluteUrl(src: string): string {
  if (/^https?:\/\//i.test(src)) {
    return src;
  }
  return new URL(src, window.location.origin).toString();
}

async function loadThumbDataUrl(src: string | null): Promise<string | null> {
  if (!src) {
    return null;
  }

  const work = async (): Promise<string | null> => {
    try {
      const response = await fetch(absoluteUrl(src), {
        credentials: "same-origin",
        cache: "force-cache",
      });
      if (!response.ok) {
        return null;
      }
      const blob = await response.blob();
      const bitmap = await createImageBitmap(blob);
      const size = 56;
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
      bitmap.close();
      return canvas.toDataURL("image/jpeg", 0.72);
    } catch {
      return null;
    }
  };

  return Promise.race([
    work(),
    new Promise<null>((resolve) => {
      window.setTimeout(() => resolve(null), 2000);
    }),
  ]);
}

async function buildDocDefinition(
  products: PricePdfProduct[],
): Promise<TDocumentDefinitions> {
  const dateLabel = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  const thumbs = await Promise.all(
    products.map((product) => loadThumbDataUrl(product.imageUrl)),
  );

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
        : { text: "—", alignment: "center", color: "#808081" },
      { text: product.name, margin: [0, 6, 0, 0] },
      {
        text: formatPrice(product.listPrice),
        alignment: "right",
        bold: true,
        margin: [0, 6, 0, 0],
      },
      {
        text: `${product.stock} шт`,
        alignment: "right",
        margin: [0, 6, 0, 0],
      },
    ]);
  });

  return {
    pageSize: "A4",
    pageMargins: [24, 28, 24, 28],
    defaultStyle: {
      font: "Roboto",
      fontSize: 9,
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
          widths: [34, "*", 72, 48],
          body: tableBody,
        },
        layout: {
          hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.5),
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
  return pdfMake as {
    createPdf: (doc: TDocumentDefinitions) => {
      download: (name?: string) => void;
      getBlob: (cb: (blob: Blob) => void) => void;
    };
  };
}

function fileName(): string {
  const stamp = new Intl.DateTimeFormat("sv-SE").format(new Date());
  return `shapecraft-price-${stamp}.pdf`;
}

/** На телефоне надёжнее открыть blob URL, чем полагаться на download(). */
export async function openPriceListPdf(
  products: PricePdfProduct[],
): Promise<void> {
  const pdfMake = await getPdfMake();
  const doc = await buildDocDefinition(products);

  const blob = await new Promise<Blob>((resolve, reject) => {
    try {
      pdfMake.createPdf(doc).getBlob((value) => resolve(value));
    } catch (error) {
      reject(error);
    }
  });

  const name = fileName();
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

export async function shareOrOpenPriceListPdf(
  products: PricePdfProduct[],
): Promise<"shared" | "opened"> {
  const pdfMake = await getPdfMake();
  const doc = await buildDocDefinition(products);

  const blob = await new Promise<Blob>((resolve, reject) => {
    try {
      pdfMake.createPdf(doc).getBlob((value) => resolve(value));
    } catch (error) {
      reject(error);
    }
  });

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

  pdfMake.createPdf(doc).download(name);
  return "opened";
}
