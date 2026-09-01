import type { ReactNode } from "react";
import type { NavIconName } from "@/components/app-nav-config";

const iconPaths: Record<NavIconName, ReactNode> = {
  store: (
    <>
      <path d="M3 9.5 12 4l9 5.5V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5Z" />
      <path d="M9 20V12h6v8" />
    </>
  ),
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  products: (
    <>
      <path d="M12 3 21 8v8l-9 5-9-5V8l9-5Z" />
      <path d="M12 12 21 8" />
      <path d="M12 12v9" />
      <path d="M12 12 3 8" />
    </>
  ),
  sales: (
    <>
      <path d="M6 2h9l3 3v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" />
      <path d="M15 2v4h4" />
      <path d="M8 13h8" />
      <path d="M8 17h5" />
    </>
  ),
  "sale-new": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8" />
      <path d="M8 12h8" />
    </>
  ),
  settlements: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 9h4" />
      <path d="M7 13h10" />
      <path d="M7 17h6" />
    </>
  ),
  receipts: (
    <>
      <path d="M12 3v12" />
      <path d="m8 7 4-4 4 4" />
      <path d="M5 21h14" />
      <path d="M7 15h10v6H7z" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 19c0-3 2.5-5 6-5s6 2 6 5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M15 19c.3-2 1.6-3.5 4-3.5" />
    </>
  ),
  visits: (
    <>
      <path d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7Z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  feedback: (
    <>
      <path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H8l-4 3V6a1 1 0 0 1 1-1Z" />
      <path d="M8 10h8" />
      <path d="M8 13h5" />
    </>
  ),
  security: (
    <>
      <path d="M12 3 20 7v6c0 4.5-3.5 7.5-8 8-4.5-.5-8-3.5-8-8V7l8-4Z" />
      <path d="m9.5 12 1.8 1.8L15 10" />
    </>
  ),
  display: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8" />
      <path d="M12 16v4" />
    </>
  ),
};

export function NavIcon({
  name,
  className = "h-5 w-5",
}: {
  name: NavIconName;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {iconPaths[name]}
    </svg>
  );
}
