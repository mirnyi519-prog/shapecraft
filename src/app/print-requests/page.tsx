import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import {
  PrintRequestList,
  type PrintRequestRow,
} from "@/components/print-request-list";
import { getSession, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isPrintRequestStatus } from "@/lib/print-request";

export default async function PrintRequestsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?next=/print-requests");
  }
  if (!isAdmin(session.role)) {
    redirect("/dashboard");
  }

  const rows = await prisma.printRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const initial: PrintRequestRow[] = rows.map((row) => ({
    id: row.id,
    source: row.source,
    title: row.title,
    priceLabel: row.priceLabel,
    sourceUrl: row.sourceUrl,
    customerName: row.customerName,
    phone: row.phone,
    quantity: row.quantity,
    status: isPrintRequestStatus(row.status) ? row.status : "new",
    createdAt: row.createdAt.toISOString(),
  }));

  const fresh = initial.filter((row) => row.status === "new").length;

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Печать</h1>
          <p className="text-[var(--muted)]">
            Заявки с витрины и из «В мире». Новых: {fresh}.
          </p>
        </div>
        <PrintRequestList initial={initial} />
      </div>
    </AppShell>
  );
}
