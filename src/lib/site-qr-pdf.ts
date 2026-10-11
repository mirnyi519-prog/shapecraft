import type { TDocumentDefinitions } from "pdfmake/interfaces";
import { renderSiteQrPng } from "@/lib/site-qr";
import { MOSCOW_TZ } from "@/lib/timezone";

function fileName(): string {
  const stamp = new Intl.DateTimeFormat("sv-SE", {
    timeZone: MOSCOW_TZ,
  }).format(new Date());
  return `shapecraft-qr-${stamp}.pdf`;
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

async function createPdfBlob(siteUrl: string): Promise<Blob> {
  const image = await renderSiteQrPng(siteUrl);
  const host = siteUrl.replace(/^https?:\/\//, "");
  const doc: TDocumentDefinitions = {
    pageSize: "A5",
    pageMargins: [36, 48, 36, 36],
    defaultStyle: { font: "Roboto", color: "#1a1a1a" },
    content: [
      { image, width: 280, alignment: "center" },
      {
        text: "ShapeCraft",
        alignment: "center",
        bold: true,
        fontSize: 22,
        margin: [0, 16, 0, 4],
      },
      {
        text: host,
        alignment: "center",
        fontSize: 14,
        color: "#808081",
      },
    ],
  };

  const pdfMake = await getPdfMake();
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

export async function openSiteQrPdf(siteUrl: string): Promise<void> {
  const blob = await createPdfBlob(siteUrl);
  deliverBlob(blob, fileName());
}

export async function shareOrOpenSiteQrPdf(
  siteUrl: string,
): Promise<"shared" | "opened"> {
  const blob = await createPdfBlob(siteUrl);
  const name = fileName();
  const file = new File([blob], name, { type: "application/pdf" });

  if (
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({
        files: [file],
        title: "QR ShapeCraft",
        text: siteUrl,
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
