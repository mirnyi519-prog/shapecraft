import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { FeedbackManager } from "@/components/feedback-manager";
import { getSession, isAdmin } from "@/lib/auth";
import { mapFeedbackMessage } from "@/lib/feedback";
import { prisma } from "@/lib/db";

export default async function FeedbackPage() {
  const session = await getSession();
  if (!session) {
    return null;
  }

  if (!isAdmin(session.role)) {
    redirect("/dashboard");
  }

  const messages = await prisma.feedbackMessage.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      product: { select: { id: true, name: true } },
    },
  });

  const unreadCount = messages.filter((item) => !item.read).length;

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Обратная связь</h1>
          <p className="text-[var(--muted)]">
            Сообщения с витрины от посетителей сайта.
          </p>
        </div>
        <FeedbackManager
          initialMessages={messages.map(mapFeedbackMessage)}
          initialUnreadCount={unreadCount}
        />
      </div>
    </AppShell>
  );
}
