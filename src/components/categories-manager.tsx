"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Input } from "@/components/ui";

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  active: boolean;
  productCount: number;
};

export function CategoriesManager({ categories }: { categories: CategoryRow[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSort, setEditSort] = useState("0");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Ошибка сохранения");
      setLoading(false);
      return;
    }

    setName("");
    setLoading(false);
    router.refresh();
  }

  function startEdit(category: CategoryRow) {
    setEditingId(category.id);
    setEditName(category.name);
    setEditSort(String(category.sortOrder));
    setError("");
  }

  async function handleSave(categoryId: string) {
    setBusyId(categoryId);
    setError("");

    const response = await fetch(`/api/categories/${categoryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName,
        sortOrder: Number(editSort),
      }),
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Ошибка сохранения");
      setBusyId(null);
      return;
    }

    setEditingId(null);
    setBusyId(null);
    router.refresh();
  }

  async function toggleActive(category: CategoryRow) {
    setBusyId(category.id);
    setError("");

    const response = await fetch(`/api/categories/${category.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !category.active }),
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Ошибка обновления");
      setBusyId(null);
      return;
    }

    setBusyId(null);
    router.refresh();
  }

  async function handleDelete(category: CategoryRow) {
    if (
      !confirm(
        `Удалить раздел «${category.name}»? Он снимется со всех товаров (${category.productCount}).`,
      )
    ) {
      return;
    }

    setBusyId(category.id);
    setError("");

    const response = await fetch(`/api/categories/${category.id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Ошибка удаления");
      setBusyId(null);
      return;
    }

    setBusyId(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card title="Новый раздел">
        <form onSubmit={handleCreate} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              label="Название"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Например: Кликеры"
              required
            />
          </div>
          <Button type="submit" className="min-h-11 sm:w-40" disabled={loading}>
            {loading ? "Сохранение..." : "Добавить"}
          </Button>
        </form>
      </Card>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Card title="Справочник разделов">
        {categories.length === 0 ? (
          <p className="text-[var(--muted)]">Разделов пока нет. Добавьте первый.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] text-[var(--muted)]">
                <tr>
                  <th className="px-3 py-2 font-medium">Название</th>
                  <th className="hidden px-3 py-2 font-medium sm:table-cell">Порядок</th>
                  <th className="px-3 py-2 font-medium">Товаров</th>
                  <th className="px-3 py-2 font-medium">Статус</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => {
                  const editing = editingId === category.id;
                  const busy = busyId === category.id;

                  return (
                    <tr
                      key={category.id}
                      className="border-b border-[var(--border)] last:border-b-0"
                    >
                      <td className="px-3 py-3">
                        {editing ? (
                          <input
                            value={editName}
                            onChange={(event) => setEditName(event.target.value)}
                            className="w-full rounded-lg border border-[var(--border)] px-3 py-2"
                          />
                        ) : (
                          <div>
                            <p className="font-medium">{category.name}</p>
                            <p className="text-xs text-[var(--muted)]">{category.slug}</p>
                          </div>
                        )}
                      </td>
                      <td className="hidden px-3 py-3 sm:table-cell">
                        {editing ? (
                          <input
                            type="number"
                            value={editSort}
                            onChange={(event) => setEditSort(event.target.value)}
                            className="w-20 rounded-lg border border-[var(--border)] px-3 py-2"
                          />
                        ) : (
                          category.sortOrder
                        )}
                      </td>
                      <td className="px-3 py-3">{category.productCount}</td>
                      <td className="px-3 py-3">
                        <Badge tone={category.active ? "success" : "neutral"}>
                          {category.active ? "На витрине" : "Скрыт"}
                        </Badge>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap justify-end gap-2">
                          {editing ? (
                            <>
                              <Button
                                type="button"
                                className="min-h-9 px-3 text-sm"
                                disabled={busy}
                                onClick={() => void handleSave(category.id)}
                              >
                                Сохранить
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                className="min-h-9 px-3 text-sm"
                                disabled={busy}
                                onClick={() => setEditingId(null)}
                              >
                                Отмена
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                type="button"
                                variant="secondary"
                                className="min-h-9 px-3 text-sm"
                                disabled={busy}
                                onClick={() => startEdit(category)}
                              >
                                Изменить
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                className="min-h-9 px-3 text-sm"
                                disabled={busy}
                                onClick={() => void toggleActive(category)}
                              >
                                {category.active ? "Скрыть" : "Показать"}
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                className="min-h-9 px-3 text-sm text-red-700"
                                disabled={busy}
                                onClick={() => void handleDelete(category)}
                              >
                                Удалить
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
