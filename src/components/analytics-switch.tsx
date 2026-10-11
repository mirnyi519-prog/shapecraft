import Link from "next/link";

export function AnalyticsSwitch({ current }: { current: "visits" | "views" }) {
  const itemClass = (active: boolean) =>
    `rounded-full px-4 py-2 text-sm font-medium transition ${
      active ? "bg-[var(--brand)] text-white" : "text-[var(--text)] hover:bg-[var(--bg)]"
    }`;

  return (
    <div
      className="inline-flex rounded-full border border-[var(--border)] bg-white p-1"
      role="tablist"
      aria-label="Аналитика витрины"
    >
      <Link
        href="/visits"
        role="tab"
        aria-selected={current === "visits"}
        className={itemClass(current === "visits")}
      >
        Посещения
      </Link>
      <Link
        href="/views"
        role="tab"
        aria-selected={current === "views"}
        className={itemClass(current === "views")}
      >
        Просмотры
      </Link>
    </div>
  );
}
