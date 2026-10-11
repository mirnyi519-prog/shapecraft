import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PrintLabelButton } from "@/components/print-label-button";
import { getSession, isAdmin } from "@/lib/auth";
import { code128Modules } from "@/lib/code128";
import { prisma } from "@/lib/db";
import { getSellerName } from "@/lib/store-settings";
import { formatMoscow } from "@/lib/timezone";

const SENDER_NAME = "ShapeCraft";

function barcodeRects(value: string) {
  const modules = code128Modules(value);
  const quiet = 10;
  const rects: { x: number; width: number }[] = [];
  let x = quiet;
  let run = 0;
  let drawing = false;
  for (const bit of modules) {
    if (bit === "1") {
      if (!drawing) {
        drawing = true;
        run = x;
      }
    } else if (drawing) {
      rects.push({ x: run, width: x - run });
      drawing = false;
    }
    x += 1;
  }
  if (drawing) {
    rects.push({ x: run, width: x - run });
  }
  return { rects, width: x + quiet };
}

export default async function DeliveryOrderLabelPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  const session = await getSession();
  const { id } = await params;
  const query = await searchParams;
  if (!session) {
    redirect(`/login?next=/delivery-orders/${id}/label`);
  }
  if (!isAdmin(session.role)) {
    redirect("/dashboard");
  }

  const order = await prisma.deliveryOrder.findUnique({
    where: { id },
  });
  if (!order) {
    notFound();
  }

  const sellerName = (await getSellerName()).trim();
  const shipment = (order.cdekNumber || order.number).replace(/\s/g, "");
  const phone = order.recipientPhone.replace(/\D/g, "");
  const barcode = barcodeRects(shipment);
  const printedAt = formatMoscow(new Date(), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).replace(",", "");
  const pickup = order.deliveryMode === "pvz";
  const point = order.pvzCode?.trim() || order.pvzAddress?.trim() || "—";

  return (
    <div className="min-h-screen bg-[#e8e8e8] text-black">
      <style>{`
        @media print {
          @page { size: 100mm 150mm; margin: 0; }
          html, body { margin: 0 !important; background: white !important; }
        }
      `}</style>
      <div className="no-print border-b border-[#ccc] bg-white px-4 py-3">
        <div className="mx-auto flex w-[100mm] items-center justify-between gap-3">
          <Link href={`/delivery-orders/${order.id}`} className="text-sm font-medium text-[var(--brand)]">
            К заказу
          </Link>
          <PrintLabelButton auto={query.print === "1"} />
        </div>
      </div>
      <article className="mx-auto box-border flex h-[150mm] w-[100mm] flex-col bg-white px-[4mm] py-[3.5mm] font-[Arial,sans-serif] text-[9pt] leading-tight text-black shadow-sm print:shadow-none">
        <header className="grid grid-cols-[22mm_1fr_28mm] items-start">
          <div>
            <svg viewBox="0 0 64 64" className="h-[12mm] w-[12mm]" aria-hidden>
              <circle cx="32" cy="32" r="30" fill="#6fbf44" />
              <path d="M14 36c10-16 22-20 38-16-8 4-14 8-18 16 6-2 14-2 22 2-12 10-28 12-42-2Z" fill="white" />
            </svg>
            <p className="mt-0.5 text-[11pt] font-black tracking-tight">CDEK</p>
          </div>
          <div className="flex justify-center pt-1">
            <svg viewBox="0 0 48 48" className="h-[12mm] w-[12mm]" aria-hidden>
              <path d="M24 6v8M16 14h16" fill="none" stroke="black" strokeWidth="2" />
              <path d="M18 14 10 30h16L18 14Zm12 0 8 16H22l8-16Z" fill="none" stroke="black" strokeWidth="1.6" />
              <path d="M8 34h32" stroke="black" strokeWidth="2" />
            </svg>
          </div>
          <div className="text-right text-[8pt]">
            <p>&gt; в СДЭК</p>
            <p className="mt-2">{order.number}</p>
          </div>
        </header>

        <section className="mt-[3mm] grid grid-cols-[28mm_1fr] gap-x-2 border-b border-black pb-[2.5mm]">
          <p className="text-[11pt] font-bold">Покупатель</p>
          <div className="text-[10pt] leading-snug">
            <p className="font-semibold">{order.recipientName}</p>
            <p>тел. {phone}</p>
            <p>заказ № {order.number}</p>
          </div>
        </section>

        <section className="mt-[2.5mm] border-b border-black pb-[2mm]">
          <p className="text-[8pt]">
            Отправление <span className="ml-3 tracking-wide">{shipment}</span>
          </p>
          <svg
            viewBox={`0 0 ${barcode.width} 48`}
            preserveAspectRatio="none"
            className="mt-1 h-[18mm] w-full"
            role="img"
            aria-label={shipment}
          >
            {barcode.rects.map((bar) => (
              <rect key={`${bar.x}-${bar.width}`} x={bar.x} y="0" width={bar.width} height="40" fill="black" />
            ))}
          </svg>
          <p className="text-center text-[10pt] tracking-wider">{shipment}</p>
        </section>

        <section className="mt-[2mm] border-b border-black pb-[2.5mm] text-[9pt] leading-snug">
          <p>Продавец: {sellerName || "—"}</p>
          <p>Отправитель: {SENDER_NAME}</p>
          <p>Исполнитель (агент): СДЭК</p>
        </section>

        <section className="mt-[3mm] grid grid-cols-[24mm_1fr] text-[9pt]">
          <p>Вид оплаты</p>
          <p className="font-semibold">платеж 0 руб</p>
        </section>

        <section className="mt-[4mm] text-[9pt] uppercase leading-snug">
          {pickup ? (
            <>
              <p>Самовывоз</p>
              <p>Пункт выдачи заказов: {point}</p>
            </>
          ) : (
            <>
              <p>Курьер</p>
              <p>
                Адрес: {order.city}
                {order.address ? `, ${order.address}` : ""}
              </p>
            </>
          )}
          <p className="mt-1 normal-case">Телефон клиента: {phone}</p>
        </section>

        <footer className="mt-auto flex items-end justify-between pt-[3mm]">
          <p className="text-[8pt]">{printedAt}</p>
          <div className="text-right">
            <p className="text-[10pt] font-semibold">Кол-во мест</p>
            <p className="text-[16pt] font-semibold leading-none">1 / 1</p>
          </div>
        </footer>
      </article>
    </div>
  );
}
