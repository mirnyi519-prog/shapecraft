"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import type { AppNavItem } from "@/components/app-nav-config";
import {
  DesktopAppSidebar,
  MobileAppNav,
} from "@/components/app-navigation";
import { FeedbackSidebar } from "@/components/feedback-sidebar";
import { LogoutButton } from "@/components/logout-button";
import type { FeedbackRow } from "@/lib/feedback";

export function AppShellFrame({
  admin,
  sessionName,
  navItems,
  feedbackMessages,
  feedbackUnreadCount,
  children,
}: {
  admin: boolean;
  sessionName?: string;
  navItems: AppNavItem[];
  feedbackMessages: FeedbackRow[];
  feedbackUnreadCount: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const showFeedbackPanel = admin && !pathname.startsWith("/feedback");

  return (
    <>
      <Suspense fallback={null}>
        <DesktopAppSidebar items={navItems} userName={sessionName} />
      </Suspense>

      <div className={showFeedbackPanel ? "lg:pl-60 lg:pr-80" : "lg:pl-60"}>
        <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-white/95 backdrop-blur lg:border-b-0 lg:bg-transparent lg:backdrop-blur-none">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:py-4 lg:justify-end lg:py-3">
            <div className="min-w-0 lg:hidden">
              <Link
                href="/"
                className="block truncate text-lg font-bold text-[var(--brand)] sm:text-xl"
              >
                ShapeCraft
              </Link>
              <p className="truncate text-xs text-[var(--muted)] sm:text-sm">
                shapecraft.ru
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <span className="hidden max-w-[8rem] truncate text-sm text-[var(--muted)] sm:inline lg:hidden">
                {sessionName}
              </span>
              <LogoutButton />
            </div>
          </div>
          <Suspense fallback={null}>
            <MobileAppNav items={navItems} />
          </Suspense>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-4 pb-10 sm:py-6">{children}</main>
      </div>

      {showFeedbackPanel ? (
        <FeedbackSidebar
          initialMessages={feedbackMessages}
          initialUnreadCount={feedbackUnreadCount}
        />
      ) : null}
    </>
  );
}
