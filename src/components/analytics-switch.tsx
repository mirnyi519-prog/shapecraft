import Link from "next/link";
import { chromeTab } from "@/components/ui";

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
  return (
    <nav className="chrome-tabs on-page" role="tablist" aria-label="Аналитика">
      {TABS.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          role="tab"
          aria-selected={current === tab.id}
          className={chromeTab(current === tab.id)}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
