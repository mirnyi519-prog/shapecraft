import Link from "next/link";

const TABS = [
  { id: "visits", href: "/visits", label: "Посещения" },
  { id: "views", href: "/views", label: "Просмотры" },
  { id: "filament", href: "/filament", label: "Филамент" },
] as const;

export function AnalyticsSwitch({
  current,
}: {
  current: (typeof TABS)[number]["id"];
}) {
  const itemClass = (active: boolean) =>
    `rounded-full px-4 py-2 text-sm font-medium transition ${
      active ? "bg-[var(--brand)] text-white" : "text-[var(--text)] hover:bg-[var(--bg)]"
    }`;

  return (
    <div
      className="inline-flex max-w-full overflow-x-auto rounded-full border border-[var(--border)] bg-white p-1"
      role="tablist"
      aria-label="Аналитика"
    >
      {TABS.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          role="tab"
          aria-selected={current === tab.id}
          className={`shrink-0 ${itemClass(current === tab.id)}`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
