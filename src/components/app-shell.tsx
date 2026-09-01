import { getSession, isAdmin } from "@/lib/auth";
import { getAppNavItems } from "@/components/app-nav-config";
import { AppShellFrame } from "@/components/app-shell-frame";
import { mapFeedbackMessage } from "@/lib/feedback";
import { prisma } from "@/lib/db";

async function loadFeedbackPreview() {
  const messages = await prisma.feedbackMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: 40,
    include: {
      product: { select: { id: true, name: true } },
    },
  });

  const rows = messages.map(mapFeedbackMessage);
  const unreadCount = rows.filter((item) => !item.read).length;

  return { messages: rows, unreadCount };
}

export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const admin = session ? isAdmin(session.role) : false;
  const navItems = getAppNavItems(admin);
  const feedback = admin
    ? await loadFeedbackPreview()
    : { messages: [], unreadCount: 0 };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <AppShellFrame
        admin={admin}
        sessionName={session?.name}
        navItems={navItems}
        feedbackMessages={feedback.messages}
        feedbackUnreadCount={feedback.unreadCount}
      >
        {children}
      </AppShellFrame>
    </div>
  );
}
