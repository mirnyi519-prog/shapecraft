"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ManagedUser, UserForm } from "@/components/forms";
import { Badge, Button, Card } from "@/components/ui";
import { roleLabel } from "@/lib/labels";
import { formatDate } from "@/lib/calculations";

type UserRow = ManagedUser & {
  id: string;
  createdAt: string;
};

export function UsersManager({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"list" | "create" | "edit">("list");
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(user: UserRow) {
    if (!confirm(`Удалить пользователя ${user.name}?`)) {
      return;
    }
    setDeletingId(user.id);
    setError("");

    const response = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Ошибка удаления");
      setDeletingId(null);
      return;
    }

    setDeletingId(null);
    router.refresh();
  }

  if (mode === "create") {
    return (
      <Card
        title="Новый пользователь"
        action={
          <Button variant="secondary" onClick={() => setMode("list")}>
            Назад
          </Button>
        }
      >
        <UserForm onDone={() => setMode("list")} />
      </Card>
    );
  }

  if (mode === "edit" && editing) {
    return (
      <Card
        title="Редактирование"
        action={
          <Button
            variant="secondary"
            onClick={() => {
              setMode("list");
              setEditing(null);
            }}
          >
            Назад
          </Button>
        }
      >
        <UserForm
          initial={editing}
          onDone={() => {
            setMode("list");
            setEditing(null);
          }}
        />
      </Card>
    );
  }

  return (
    <Card
      title="Список пользователей"
      action={
        <Button onClick={() => setMode("create")}>+ Добавить</Button>
      }
    >
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-[var(--muted)]">
              <th className="px-3 py-3">Имя</th>
              <th className="px-3 py-3">Логин</th>
              <th className="px-3 py-3">Роль</th>
              <th className="px-3 py-3">Создан</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-[var(--border)]">
                <td className="px-3 py-3 font-medium">
                  {user.name}
                  {user.id === currentUserId ? (
                    <span className="ml-2 text-xs text-[var(--muted)]">(вы)</span>
                  ) : null}
                </td>
                <td className="px-3 py-3">{user.login}</td>
                <td className="px-3 py-3">
                  <Badge tone={user.role === "admin" ? "success" : "neutral"}>
                    {roleLabel(user.role)}
                  </Badge>
                </td>
                <td className="px-3 py-3">{formatDate(user.createdAt)}</td>
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setEditing(user);
                        setMode("edit");
                      }}
                    >
                      Изменить
                    </Button>
                    {user.id !== currentUserId ? (
                      <Button
                        variant="danger"
                        disabled={deletingId === user.id}
                        onClick={() => void handleDelete(user)}
                      >
                        Удалить
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
