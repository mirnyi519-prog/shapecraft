import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { OrdersSettingsEditor } from "@/components/orders-settings-editor";
import { getSession, isAdmin } from "@/lib/auth";
import { getDeliveryOrdersEnabled, getSellerName } from "@/lib/store-settings";

export default async function SettingsOrdersPage() {
  const session = await getSession();
  if (!session) {
    return null;
  }
  if (!isAdmin(session.role)) {
    redirect("/dashboard");
  }

  const [enabled, sellerName] = await Promise.all([
    getDeliveryOrdersEnabled(),
    getSellerName(),
  ]);

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Режим заказов</h1>
          <p className="text-[var(--muted)]">
            {enabled
              ? "Заказы включены. Регистрация покупателя и оформление СДЭК на витрине ещё не выложены."
              : "Заказы выключены. На витрине нет регистрации и нет заказа с доставкой."}
          </p>
        </div>
        <OrdersSettingsEditor initialEnabled={enabled} initialSellerName={sellerName} />
      </div>
    </AppShell>
  );
}
