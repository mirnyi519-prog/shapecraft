"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ProductPhoto } from "@/components/product-photo";
import { Button, Input, Textarea } from "@/components/ui";

export { LoginForm } from "@/components/login-form";

export function ProductForm({
  initial,
  canEditCost = false,
  categories = [],
}: {
  initial?: ProductFormValues;
  canEditCost?: boolean;
  categories?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<ProductFormValues>(
    initial ?? {
      name: "",
      description: "",
      imageUrl: "",
      costPrice: "",
      listPrice: "",
      stock: "0",
      weightGrams: "",
      widthMm: "",
      heightMm: "",
      depthMm: "",
      categoryIds: [],
    },
  );
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    const type = file.type || "";
    const looksLikeImage =
      type.startsWith("image/") ||
      /\.(png|jpe?g|webp|gif)$/i.test(file.name || "");

    if (!looksLikeImage) {
      setError("Можно загружать только изображения");
      return;
    }

    setUploading(true);
    setError("");
    const formData = new FormData();
    const named =
      file.name && file.name !== "blob"
        ? file
        : new File([file], `paste-${Date.now()}.png`, {
            type: type || "image/png",
          });
    formData.append("file", named);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        setError(data.error ?? "Ошибка загрузки фото");
        setUploading(false);
        return;
      }

      setValues((current) => ({ ...current, imageUrl: data.url! }));
    } catch {
      setError("Не удалось загрузить фото. Проверьте сеть и вход.");
    }
    setUploading(false);
  }

  const handleUploadRef = useRef(handleUpload);
  handleUploadRef.current = handleUpload;

  function takeImageFromDataTransfer(data: DataTransfer | null) {
    if (!data) {
      return false;
    }

    for (const item of Array.from(data.items)) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          void handleUploadRef.current(file);
          return true;
        }
      }
    }

    for (const file of Array.from(data.files)) {
      if (
        file.type.startsWith("image/") ||
        /\.(png|jpe?g|webp|gif)$/i.test(file.name)
      ) {
        void handleUploadRef.current(file);
        return true;
      }
    }

    return false;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const payload: Record<string, string | number | string[] | null | undefined> = {
      name: values.name,
      description: values.description,
      imageUrl: values.imageUrl || undefined,
      listPrice:
        values.listPrice.trim() === "" ? null : Number(values.listPrice),
      stock: Number(values.stock),
      weightGrams:
        values.weightGrams.trim() === "" ? null : Number(values.weightGrams),
      widthMm: values.widthMm.trim() === "" ? null : Number(values.widthMm),
      heightMm: values.heightMm.trim() === "" ? null : Number(values.heightMm),
      depthMm: values.depthMm.trim() === "" ? null : Number(values.depthMm),
      categoryIds: values.categoryIds,
    };

    if (canEditCost) {
      payload.costPrice = Number(values.costPrice);
    }

    if (
      payload.listPrice !== null &&
      payload.listPrice !== undefined &&
      !Number.isFinite(Number(payload.listPrice))
    ) {
      setError("Некорректная цена в прайсе");
      setLoading(false);
      return;
    }

    const response = await fetch(
      initial?.id ? `/api/products/${initial.id}` : "/api/products",
      {
        method: initial?.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Ошибка сохранения");
      setLoading(false);
      return;
    }

    router.push("/products");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Название"
        value={values.name}
        onChange={(event) => setValues({ ...values, name: event.target.value })}
        required
      />
      <Textarea
        label="Описание"
        value={values.description}
        onChange={(event) =>
          setValues({ ...values, description: event.target.value })
        }
      />
      {categories.length > 0 ? (
        <div className="space-y-2">
          <span className="text-sm font-medium">Разделы витрины</span>
          <p className="text-sm text-[var(--muted)]">
            Можно выбрать несколько. Клиент фильтрует по ним на витрине.
          </p>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => {
              const selected = values.categoryIds.includes(category.id);
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() =>
                    setValues((current) => ({
                      ...current,
                      categoryIds: selected
                        ? current.categoryIds.filter((id) => id !== category.id)
                        : [...current.categoryIds, category.id],
                    }))
                  }
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                    selected
                      ? "bg-[var(--brand)] text-white"
                      : "border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] hover:bg-white"
                  }`}
                >
                  {category.name}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="rounded-xl bg-[var(--bg)] px-4 py-3 text-sm text-[var(--muted)]">
          Разделы пока не созданы. Добавьте их в меню «Разделы».
        </p>
      )}
      <div className="space-y-2">
        <span className="text-sm font-medium">Фото</span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void handleUpload(file);
            }
            event.target.value = "";
          }}
        />
        <div
          tabIndex={0}
          role="button"
          aria-label="Зона загрузки фото"
          onPaste={(event) => {
            if (takeImageFromDataTransfer(event.clipboardData)) {
              event.preventDefault();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragOver(false);
            const file = event.dataTransfer.files?.[0];
            if (file) {
              void handleUpload(file);
            }
          }}
          className={`rounded-xl border border-dashed p-4 transition outline-none focus:border-[var(--brand)] ${
            dragOver
              ? "border-[var(--brand)] bg-[var(--brand-soft)]"
              : "border-[var(--border)] bg-[var(--bg)]"
          }`}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {values.imageUrl ? (
              <div className="w-full max-w-[12rem] shrink-0 sm:w-40">
                <ProductPhoto
                  src={values.imageUrl}
                  alt="Preview"
                  frameClassName="aspect-square h-auto"
                />
              </div>
            ) : (
              <div className="flex h-40 w-full max-w-[12rem] shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--brand-soft)]/35 text-sm text-[var(--muted)] sm:w-40">
                Нет фото
              </div>
            )}
            <div className="space-y-2">
              <Button
                type="button"
                variant="secondary"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? "Загрузка..." : "Загрузить фото"}
              </Button>
              <p className="text-sm text-[var(--muted)]">
                Кликните в зону фото и нажмите Ctrl+V — вставится скриншот
              </p>
              <p className="text-sm text-[var(--muted)]">
                В название и описание текст вставляется как обычно
              </p>
              <p className="text-sm text-[var(--muted)]">
                Или перетащите файл сюда
              </p>
              {values.imageUrl ? (
                <button
                  type="button"
                  className="text-sm text-red-600 hover:underline"
                  onClick={() =>
                    setValues((current) => ({ ...current, imageUrl: "" }))
                  }
                >
                  Убрать фото
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <div className={`grid gap-4 ${canEditCost ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {canEditCost ? (
          <Input
            label="Себестоимость, ₽"
            type="number"
            min="0"
            step="1"
            value={values.costPrice}
            onChange={(event) =>
              setValues({ ...values, costPrice: event.target.value })
            }
            required
          />
        ) : null}
        <Input
          label="Цена в прайсе, ₽"
          type="number"
          min="0"
          step="1"
          value={values.listPrice}
          onChange={(event) =>
            setValues({ ...values, listPrice: event.target.value })
          }
          placeholder="Пока не знаю"
        />
        <Input
          label="Остаток, шт"
          type="number"
          min="0"
          step="1"
          value={values.stock}
          onChange={(event) => setValues({ ...values, stock: event.target.value })}
          required
        />
      </div>
      <div>
        <p className="mb-3 text-sm font-medium">Вес и габариты</p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Input
            label="Вес, г"
            type="number"
            min="0"
            step="0.1"
            value={values.weightGrams}
            onChange={(event) =>
              setValues({ ...values, weightGrams: event.target.value })
            }
            placeholder="45"
          />
          <Input
            label="Ширина, мм"
            type="number"
            min="0"
            step="1"
            value={values.widthMm}
            onChange={(event) =>
              setValues({ ...values, widthMm: event.target.value })
            }
            placeholder="60"
          />
          <Input
            label="Высота, мм"
            type="number"
            min="0"
            step="1"
            value={values.heightMm}
            onChange={(event) =>
              setValues({ ...values, heightMm: event.target.value })
            }
            placeholder="40"
          />
          <Input
            label="Глубина, мм"
            type="number"
            min="0"
            step="1"
            value={values.depthMm}
            onChange={(event) =>
              setValues({ ...values, depthMm: event.target.value })
            }
            placeholder="35"
          />
        </div>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="submit" disabled={loading || uploading}>
        {loading ? "Сохранение..." : "Сохранить"}
      </Button>
    </form>
  );
}

export type ProductFormValues = {
  id?: string;
  name: string;
  description: string;
  imageUrl: string;
  costPrice: string;
  listPrice: string;
  stock: string;
  weightGrams: string;
  widthMm: string;
  heightMm: string;
  depthMm: string;
  categoryIds: string[];
};

type ProductOption = {
  id: string;
  name: string;
  listPrice: number | null;
  stock: number;
  imageUrl: string | null;
};

export type SaleFormInitial = {
  id: string;
  productId: string;
  quantity: number;
  amount: number;
  note: string;
  settled: boolean;
};

export function SaleForm({
  products,
  initial,
  defaultProductId,
  redirectTo = "/sales",
}: {
  products: ProductOption[];
  initial?: SaleFormInitial;
  defaultProductId?: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const isEdit = Boolean(initial?.id);
  const settledOnlyNote = Boolean(initial?.settled);
  const sellable = products.filter(
    (p) => p.listPrice !== null && p.listPrice !== undefined,
  );
  const options = isEdit ? products : sellable;

  const [productId, setProductId] = useState(
    initial?.productId ??
      defaultProductId ??
      options[0]?.id ??
      "",
  );
  const [quantity, setQuantity] = useState(
    initial ? String(initial.quantity) : "1",
  );
  const [amount, setAmount] = useState(() => {
    if (initial) {
      return String(initial.amount);
    }
    const first =
      options.find((p) => p.id === defaultProductId) ?? options[0];
    return first?.listPrice != null ? String(first.listPrice) : "";
  });
  const [note, setNote] = useState(initial?.note ?? "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const skipPriceAutofill = useRef(isEdit);

  const selected = options.find((product) => product.id === productId);

  useEffect(() => {
    if (!selected || settledOnlyNote || selected.listPrice == null) {
      return;
    }
    if (skipPriceAutofill.current) {
      skipPriceAutofill.current = false;
      return;
    }
    const qty = Math.max(1, Number(quantity) || 1);
    setAmount(String(selected.listPrice * qty));
  }, [productId, quantity, selected?.listPrice, settledOnlyNote]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    if (!isEdit && selected?.listPrice == null) {
      setError("Нельзя продать товар без цены в прайсе");
      setLoading(false);
      return;
    }

    const response = await fetch(
      isEdit ? `/api/sales/${initial!.id}` : "/api/sales",
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          settledOnlyNote
            ? { note }
            : {
                productId,
                quantity: Number(quantity),
                amount: Number(amount),
                note,
              },
        ),
      },
    );

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Ошибка продажи");
      setLoading(false);
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  async function handleDelete() {
    if (!initial?.id || settledOnlyNote) {
      return;
    }
    if (!window.confirm("Удалить эту продажу? Остаток товара будет возвращён.")) {
      return;
    }
    setLoading(true);
    setError("");
    const response = await fetch(`/api/sales/${initial.id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Ошибка удаления");
      setLoading(false);
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  if (options.length === 0) {
    return (
      <p className="text-[var(--muted)]">
        {products.length === 0
          ? "Сначала добавьте хотя бы один товар в каталог."
          : "Нет товаров с ценой в прайсе. Укажите прайс в карточке товара, затем продавайте."}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {settledOnlyNote ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Продажа в закрытом периоде. Можно изменить только комментарий.
        </p>
      ) : null}
      <label className="block space-y-2">
        <span className="text-sm font-medium">Товар</span>
        <select
          className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-base disabled:opacity-60"
          value={productId}
          disabled={settledOnlyNote || Boolean(defaultProductId && !isEdit)}
          onChange={(event) => setProductId(event.target.value)}
        >
          {options.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name} — остаток {product.stock}, прайс{" "}
              {product.listPrice ?? "—"} ₽
            </option>
          ))}
        </select>
      </label>
      {selected ? (
        <div className="flex items-center gap-4 rounded-xl bg-[var(--bg)] p-4">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--brand-soft)]/35">
            {selected.imageUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selected.imageUrl}
                  alt=""
                  aria-hidden
                  className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-md"
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selected.imageUrl}
                  alt={selected.name}
                  className="relative z-10 h-full w-full object-contain p-1"
                />
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-[var(--muted)]">
                Нет фото
              </div>
            )}
          </div>
          <div className="text-sm text-[var(--muted)]">
            <p className="font-medium text-[var(--text)]">{selected.name}</p>
            <p className="mt-1">
              Прайс: {selected.listPrice ?? "не задан"} ₽ · Остаток:{" "}
              {selected.stock} шт
            </p>
            {!settledOnlyNote ? (
              <p className="mt-1 text-xs">
                Сумма подставляется из прайса, её можно изменить
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Количество"
          type="number"
          min="1"
          value={quantity}
          disabled={settledOnlyNote}
          onChange={(event) => setQuantity(event.target.value)}
          required
        />
        <Input
          label="За сколько продано, ₽"
          type="number"
          min="0"
          step="1"
          value={amount}
          disabled={settledOnlyNote}
          onChange={(event) => setAmount(event.target.value)}
          required
        />
      </div>
      <Textarea
        label="Комментарий"
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" disabled={loading} className="min-h-11">
          {loading
            ? "Сохранение..."
            : isEdit
              ? "Сохранить изменения"
              : "Зафиксировать продажу"}
        </Button>
        {isEdit && !settledOnlyNote ? (
          <Button
            type="button"
            variant="danger"
            disabled={loading}
            className="min-h-11"
            onClick={() => void handleDelete()}
          >
            Удалить
          </Button>
        ) : null}
      </div>
    </form>
  );
}

export function ReceiptForm({
  products,
  defaultProductId,
  redirectTo,
}: {
  products: ProductOption[];
  defaultProductId?: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [productId, setProductId] = useState(
    defaultProductId ?? products[0]?.id ?? "",
  );
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const selected = products.find((product) => product.id === productId);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/receipts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId,
        quantity: Number(quantity),
        note,
      }),
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Ошибка прихода");
      setLoading(false);
      return;
    }

    if (redirectTo) {
      router.push(redirectTo);
      router.refresh();
      return;
    }

    router.refresh();
    setQuantity("1");
    setNote("");
    setLoading(false);
  }

  if (products.length === 0) {
    return (
      <p className="text-[var(--muted)]">
        Сначала добавьте товар в каталог, затем можно оформить приход.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block space-y-2">
        <span className="text-sm font-medium">Товар</span>
        <select
          className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 disabled:opacity-60"
          value={productId}
          disabled={Boolean(defaultProductId)}
          onChange={(event) => setProductId(event.target.value)}
        >
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name} — сейчас {product.stock} шт
            </option>
          ))}
        </select>
      </label>
      {selected ? (
        <div className="flex items-center gap-4 rounded-xl bg-[var(--bg)] p-4">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-[var(--border)] bg-white">
            {selected.imageUrl ? (
              <Image
                src={selected.imageUrl}
                alt={selected.name}
                fill
                className="object-cover"
                sizes="80px"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-[var(--muted)]">
                Нет фото
              </div>
            )}
          </div>
          <div className="text-sm">
            <p className="font-medium">{selected.name}</p>
            <p className="mt-1 text-[var(--muted)]">
              Текущий остаток: {selected.stock} шт
            </p>
          </div>
        </div>
      ) : null}
      <Input
        label="Сколько напечатали, шт"
        type="number"
        min="1"
        value={quantity}
        onChange={(event) => setQuantity(event.target.value)}
        required
      />
      <Textarea
        label="Комментарий"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Например: новая партия, цвет чуть другой"
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="submit" disabled={loading}>
        {loading ? "Сохранение..." : "Оформить приход"}
      </Button>
    </form>
  );
}

export function SettlementButton() {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSettlement() {
    setLoading(true);
    setError("");

    const response = await fetch("/api/settlements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Ошибка расчёта");
      setLoading(false);
      return;
    }

    router.refresh();
    setNote("");
    setLoading(false);
  }

  return (
    <div className="space-y-3">
      <Textarea
        label="Комментарий к расчёту"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Например: перевёл на карту, наличные в кассе"
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button onClick={handleSettlement} disabled={loading}>
        {loading ? "Фиксируем..." : "Провести расчёт и обнулить период"}
      </Button>
    </div>
  );
}

export type ManagedUser = {
  id?: string;
  login: string;
  name: string;
  role: "admin" | "partner";
};

export function UserForm({
  initial,
  onDone,
}: {
  initial?: ManagedUser;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState({
    login: initial?.login ?? "",
    name: initial?.name ?? "",
    role: (initial?.role ?? "partner") as "admin" | "partner",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const isEdit = Boolean(initial?.id);
    if (!isEdit && !values.password) {
      setError("Укажите пароль");
      setLoading(false);
      return;
    }

    const response = await fetch(
      isEdit ? `/api/users/${initial!.id}` : "/api/users",
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login: values.login,
          name: values.name,
          role: values.role,
          ...(values.password ? { password: values.password } : {}),
        }),
      },
    );

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Ошибка сохранения");
      setLoading(false);
      return;
    }

    setLoading(false);
    router.refresh();
    onDone?.();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Имя"
        value={values.name}
        onChange={(event) => setValues({ ...values, name: event.target.value })}
        required
      />
      <Input
        label="Логин"
        type="text"
        autoComplete="username"
        value={values.login}
        onChange={(event) => setValues({ ...values, login: event.target.value })}
        required
      />
      <label className="block space-y-2">
        <span className="text-sm font-medium">Роль</span>
        <select
          className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-2.5"
          value={values.role}
          onChange={(event) =>
            setValues({
              ...values,
              role: event.target.value as "admin" | "partner",
            })
          }
        >
          <option value="admin">Админ</option>
          <option value="partner">Партнёр</option>
        </select>
      </label>
      <Input
        label={initial?.id ? "Новый пароль (необязательно)" : "Пароль"}
        type="password"
        value={values.password}
        onChange={(event) =>
          setValues({ ...values, password: event.target.value })
        }
        required={!initial?.id}
        minLength={6}
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="submit" disabled={loading}>
        {loading ? "Сохранение..." : "Сохранить"}
      </Button>
    </form>
  );
}
