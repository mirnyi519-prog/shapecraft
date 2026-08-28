import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { UsersManager } from "@/components/users-manager";
import { getSession, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function UsersPage() {
  const session = await getSession();
  if (!session) {
    return null;
  }

  if (!isAdmin(session.role)) {
    redirect("/dashboard");
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      login: true,
      name: true,
      role: true,
      createdAt: true,
    },
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Пользователи</h1>
          <p className="text-[var(--muted)]">
            Добавление и редактирование доступов. Себестоимость товаров может
            задавать только админ.
          </p>
        </div>
        <UsersManager
          currentUserId={session.id}
          users={users.map((user) => ({
            id: user.id,
            login: user.login,
            name: user.name,
            role: user.role === "partner" ? "partner" : "admin",
            createdAt: user.createdAt.toISOString(),
          }))}
        />
      </div>
    </AppShell>
  );
}
