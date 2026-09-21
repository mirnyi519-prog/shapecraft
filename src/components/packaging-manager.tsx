"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Input, Textarea } from "@/components/ui";
import {
  formatPackagingBoxSize,
  isPackagingCode,
  packagingRecommendHint,
  type PackagingCode,
  type PackagingOption,
} from "@/lib/packaging";

type FormState = {
  name: string;
  code: string;
  description: string;
  boxWidthMm: string;
  boxHeightMm: string;
  boxDepthMm: string;
  stock: string;
  sortOrder: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  code: "",
  description: "",
  boxWidthMm: "",
  boxHeightMm: "",
  boxDepthMm: "",
  stock: "0",
  sortOrder: "0",
};

function toForm(item: PackagingOption): FormState {
  return {
    name: item.name,
    code: item.code,
    description: item.description ?? "",
    boxWidthMm:
      item.boxWidthMm == null ? "" : String(item.boxWidthMm),
    boxHeightMm:
      item.boxHeightMm == null ? "" : String(item.boxHeightMm),
    boxDepthMm:
      item.boxDepthMm == null ? "" : String(item.boxDepthMm),
    stock: String(item.stock),
    sortOrder: String(item.sortOrder),
  };
}

function parseOptionalField(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? n : Number.NaN;
}

export function PackagingManager({ items }: { items: PackagingOption[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deltaById, setDeltaById] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);

  async function adjustStock(id: string, delta: number) {
    setBusyId(id);
    setError("");
    const response = await fetch(`/api/packaging/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stockDelta: delta }),
    });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Ошибка обновления остатка");
      setBusyId(null);
      return;
    }
    setBusyId(null);
    setDeltaById((prev) => ({ ...prev, [id]: "" }));
    router.refresh();
  }

  async function applyCustomDelta(id: string) {
    const raw = deltaById[id]?.trim() ?? "";
    const delta = Number(raw);
    if (!Number.isFinite(delta) || !Number.isInteger(delta) || delta === 0) {
      setError("Укажите целое число со знаком, например 10 или -3");
      return;
    }
    await adjustStock(id, delta);
  }

  async function toggleActive(item: PackagingOption) {
    setBusyId(item.id);
    setError("");
    const response = await fetch(`/api/packaging/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !item.active }),
    });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Ошибка");
      setBusyId(null);
      return;
    }
    setBusyId(null);
    router.refresh();
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError("");

    const w = parseOptionalField(createForm.boxWidthMm);
    const h = parseOptionalField(createForm.boxHeightMm);
    const d = parseOptionalField(createForm.boxDepthMm);
    if ([w, h, d].some((value) => Number.isNaN(value))) {
      setError("Габариты коробки — числа ≥ 0 или пусто");
      setCreating(false);
      return;
    }

    const response = await fetch("/api/packaging", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: createForm.name,
        code: createForm.code || undefined,
        description: createForm.description || null,
        boxWidthMm: w,
        boxHeightMm: h,
        boxDepthMm: d,
        stock: Number(createForm.stock) || 0,
        sortOrder: Number(createForm.sortOrder) || 0,
      }),
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Ошибка создания");
      setCreating(false);
      return;
    }

    setCreateForm(EMPTY_FORM);
    setCreating(false);
    router.refresh();
  }

  function startEdit(item: PackagingOption) {
    setEditingId(item.id);
    setEditForm(toForm(item));
    setError("");
  }

  async function handleSaveEdit(id: string) {
    setBusyId(id);
    setError("");

    const w = parseOptionalField(editForm.boxWidthMm);
    const h = parseOptionalField(editForm.boxHeightMm);
    const d = parseOptionalField(editForm.boxDepthMm);
    if ([w, h, d].some((value) => Number.isNaN(value))) {
      setError("Габариты коробки — числа ≥ 0 или пусто");
      setBusyId(null);
      return;
    }

    const response = await fetch(`/api/packaging/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editForm.name,
        code: editForm.code,
        description: editForm.description || null,
        boxWidthMm: w,
        boxHeightMm: h,
        boxDepthMm: d,
        stock: Number(editForm.stock) || 0,
        sortOrder: Number(editForm.sortOrder) || 0,
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

  async function handleDelete(item: PackagingOption) {
    const linked = item.productCount ?? 0;
    const message =
      linked > 0
        ? `Удалить «${item.name}»? У ${linked} товар(ов) упаковка сбросится.`
        : `Удалить упаковку «${item.name}»?`;
    if (!confirm(message)) {
      return;
    }

    setBusyId(item.id);
    setError("");
    const response = await fetch(`/api/packaging/${item.id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Ошибка удаления");
      setBusyId(null);
      return;
    }
    if (editingId === item.id) {
      setEditingId(null);
    }
    setBusyId(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card title="Как подбирается упаковка">
        <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
          <li>
            <strong>mini</strong> — макс. габарит ≤ 60 мм (кликеры, брелоки)
          </li>
          <li>
            <strong>long</strong> — макс. габарит ≥ 300 мм (длинный шарнир)
          </li>
          <li>
            <strong>fragile</strong> — 90–160 мм и вес &lt; 55 г (ажур)
          </li>
          <li>
            <strong>standard</strong> — остальное и товары без габаритов
          </li>
        </ul>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Можно добавлять свои типы. Для автоподбора код должен совпадать с одним
          из четырёх выше.
        </p>
      </Card>

      <Card title="Добавить упаковку">
        <form onSubmit={(event) => void handleCreate(event)} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Название"
              value={createForm.name}
              onChange={(event) =>
                setCreateForm({ ...createForm, name: event.target.value })
              }
              required
              placeholder="Короб подарочный"
            />
            <Input
              label="Код (латиница)"
              value={createForm.code}
              onChange={(event) =>
                setCreateForm({ ...createForm, code: event.target.value })
              }
              placeholder="gift-box (пусто = из названия)"
            />
          </div>
          <Textarea
            label="Описание"
            value={createForm.description}
            onChange={(event) =>
              setCreateForm({ ...createForm, description: event.target.value })
            }
            rows={2}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              label="Ширина коробки, мм"
              type="number"
              min="0"
              value={createForm.boxWidthMm}
              onChange={(event) =>
                setCreateForm({ ...createForm, boxWidthMm: event.target.value })
              }
            />
            <Input
              label="Высота, мм"
              type="number"
              min="0"
              value={createForm.boxHeightMm}
              onChange={(event) =>
                setCreateForm({ ...createForm, boxHeightMm: event.target.value })
              }
            />
            <Input
              label="Глубина, мм"
              type="number"
              min="0"
              value={createForm.boxDepthMm}
              onChange={(event) =>
                setCreateForm({ ...createForm, boxDepthMm: event.target.value })
              }
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Остаток, шт"
              type="number"
              min="0"
              value={createForm.stock}
              onChange={(event) =>
                setCreateForm({ ...createForm, stock: event.target.value })
              }
            />
            <Input
              label="Порядок"
              type="number"
              value={createForm.sortOrder}
              onChange={(event) =>
                setCreateForm({ ...createForm, sortOrder: event.target.value })
              }
            />
          </div>
          <Button type="submit" className="min-h-11" disabled={creating}>
            {creating ? "Сохранение..." : "Добавить"}
          </Button>
        </form>
      </Card>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {items.map((item) => {
          const box = formatPackagingBoxSize(item);
          const hint = isPackagingCode(item.code)
            ? packagingRecommendHint(item.code as PackagingCode)
            : null;
          const low = item.stock <= 5;
          const isEditing = editingId === item.id;

          return (
            <Card
              key={item.id}
              title={item.name}
              className={!item.active ? "opacity-70" : ""}
            >
              {isEditing ? (
                <div className="space-y-3">
                  <Input
                    label="Название"
                    value={editForm.name}
                    onChange={(event) =>
                      setEditForm({ ...editForm, name: event.target.value })
                    }
                    required
                  />
                  <Input
                    label="Код"
                    value={editForm.code}
                    onChange={(event) =>
                      setEditForm({ ...editForm, code: event.target.value })
                    }
                    required
                  />
                  <Textarea
                    label="Описание"
                    value={editForm.description}
                    onChange={(event) =>
                      setEditForm({
                        ...editForm,
                        description: event.target.value,
                      })
                    }
                    rows={2}
                  />
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Input
                      label="Ш, мм"
                      type="number"
                      min="0"
                      value={editForm.boxWidthMm}
                      onChange={(event) =>
                        setEditForm({
                          ...editForm,
                          boxWidthMm: event.target.value,
                        })
                      }
                    />
                    <Input
                      label="В, мм"
                      type="number"
                      min="0"
                      value={editForm.boxHeightMm}
                      onChange={(event) =>
                        setEditForm({
                          ...editForm,
                          boxHeightMm: event.target.value,
                        })
                      }
                    />
                    <Input
                      label="Г, мм"
                      type="number"
                      min="0"
                      value={editForm.boxDepthMm}
                      onChange={(event) =>
                        setEditForm({
                          ...editForm,
                          boxDepthMm: event.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      label="Остаток"
                      type="number"
                      min="0"
                      value={editForm.stock}
                      onChange={(event) =>
                        setEditForm({ ...editForm, stock: event.target.value })
                      }
                    />
                    <Input
                      label="Порядок"
                      type="number"
                      value={editForm.sortOrder}
                      onChange={(event) =>
                        setEditForm({
                          ...editForm,
                          sortOrder: event.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className="min-h-11"
                      disabled={busyId === item.id}
                      onClick={() => void handleSaveEdit(item.id)}
                    >
                      Сохранить
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="min-h-11"
                      disabled={busyId === item.id}
                      onClick={() => setEditingId(null)}
                    >
                      Отмена
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">{item.code}</Badge>
                    <Badge tone={low ? "warning" : "success"}>
                      Остаток: {item.stock} шт
                    </Badge>
                    {!item.active ? <Badge tone="neutral">Выкл</Badge> : null}
                    {item.productCount != null ? (
                      <span className="text-xs text-[var(--muted)]">
                        Товаров: {item.productCount}
                      </span>
                    ) : null}
                  </div>
                  {box ? (
                    <p className="text-sm text-[var(--muted)]">Короб: {box}</p>
                  ) : null}
                  {item.description ? (
                    <p className="mt-1 text-sm text-[var(--text)]">
                      {item.description}
                    </p>
                  ) : null}
                  {hint ? (
                    <p className="mt-2 text-sm text-[var(--muted)]">{hint}</p>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      className="min-h-11"
                      disabled={busyId === item.id}
                      onClick={() => startEdit(item)}
                    >
                      Редактировать
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="min-h-11"
                      disabled={busyId === item.id}
                      onClick={() => void toggleActive(item)}
                    >
                      {item.active ? "Выключить" : "Включить"}
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      className="min-h-11"
                      disabled={busyId === item.id}
                      onClick={() => void handleDelete(item)}
                    >
                      Удалить
                    </Button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      className="min-h-11"
                      disabled={busyId === item.id}
                      onClick={() => void adjustStock(item.id, 1)}
                    >
                      +1
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="min-h-11"
                      disabled={busyId === item.id || item.stock <= 0}
                      onClick={() => void adjustStock(item.id, -1)}
                    >
                      −1
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="min-h-11"
                      disabled={busyId === item.id}
                      onClick={() => void adjustStock(item.id, 10)}
                    >
                      +10
                    </Button>
                  </div>

                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <div className="w-28">
                      <Input
                        label="± шт"
                        value={deltaById[item.id] ?? ""}
                        onChange={(event) =>
                          setDeltaById((prev) => ({
                            ...prev,
                            [item.id]: event.target.value,
                          }))
                        }
                        placeholder="10"
                      />
                    </div>
                    <Button
                      type="button"
                      className="min-h-11"
                      disabled={busyId === item.id}
                      onClick={() => void applyCustomDelta(item.id)}
                    >
                      Применить
                    </Button>
                  </div>
                </>
              )}
            </Card>
          );
        })}
      </div>

      {items.length === 0 ? (
        <Card title="Пусто">
          <p className="text-sm text-[var(--muted)]">
            Добавьте первую упаковку формой выше.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
