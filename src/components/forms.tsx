"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ProductPhoto } from "@/components/product-photo";
import { Button, Input, Textarea } from "@/components/ui";
import {
  CATALOG_LINE_LABELS,
  CATALOG_LINES,
  type CatalogLine,
} from "@/lib/catalog-line";
import {
  ZERO_STOCK_MODE_HINTS,
  ZERO_STOCK_MODE_LABELS,
  ZERO_STOCK_MODES,
  type ZeroStockMode,
} from "@/lib/buy-intent";
import { MAX_PRODUCT_IMAGES } from "@/lib/product-images";

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
      imageUrls: [],
      costPrice: "",
      listPrice: "",
      stock: "0",
      weightGrams: "",
      widthMm: "",
      heightMm: "",
      depthMm: "",
      catalogLine: "souvenir",
      zeroStockMode: "soon",
      categoryIds: [],
    },
  );
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const imageUrls =
    values.imageUrls.length > 0
      ? values.imageUrls
      : values.imageUrl
        ? [values.imageUrl]
        : [];

  function setImageUrls(next: string[]) {
    const unique = Array.from(new Set(next.map((url) => url.trim()).filter(Boolean))).slice(
      0,
      MAX_PRODUCT_IMAGES,
    );
    setValues((current) => ({
      ...current,
      imageUrls: unique,
      imageUrl: unique[0] ?? "",
    }));
  }

  async function handleUpload(file: File, currentUrls: string[] = imageUrls) {
    const type = file.type || "";
    const looksLikeImage =
      type.startsWith("image/") ||
      /\.(png|jpe?g|webp|gif)$/i.test(file.name || "");
    const looksLikeVideo =
      type.startsWith("video/") || /\.(mp4|webm|mov|m4v)$/i.test(file.name || "");

    if (!looksLikeImage && !looksLikeVideo) {
      setError(
        "Можно JPEG, PNG, WebP, GIF или видео MP4/WebM/MOV (сервер сделает GIF)",
      );
      return currentUrls;
    }

    if (currentUrls.length >= MAX_PRODUCT_IMAGES) {
      setError(`Можно добавить не больше ${MAX_PRODUCT_IMAGES} фото`);
      return currentUrls;
    }

    setUploading(true);
    setError("");
    setNotice("");
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

      const data = (await response.json()) as {
        url?: string;
        error?: string;
        convertedFromVideo?: boolean;
        maxSeconds?: number;
      };
      if (!response.ok || !data.url) {
        setError(data.error ?? "Ошибка загрузки фото");
        setUploading(false);
        return currentUrls;
      }

      const next = [...currentUrls, data.url];
      setImageUrls(next);
      setUploading(false);
      if (data.convertedFromVideo) {
        setNotice(
          `Видео перекодировано в GIF (первые ${data.maxSeconds ?? 8} сек)`,
        );
      }
      return next;
    } catch {
      setError("Не удалось загрузить файл. Проверьте сеть и вход.");
      setUploading(false);
      return currentUrls;
    }
  }

  async function handleUploadMany(files: FileList | File[]) {
    const list = Array.from(files).filter(
      (file) =>
        file.type.startsWith("image/") ||
        file.type.startsWith("video/") ||
        /\.(png|jpe?g|webp|gif|mp4|webm|mov|m4v)$/i.test(file.name),
    );
    let current = imageUrls;
    for (const file of list) {
      if (current.length >= MAX_PRODUCT_IMAGES) {
        setError(`Можно добавить не больше ${MAX_PRODUCT_IMAGES} фото`);
        break;
      }
      current = await handleUpload(file, current);
    }
  }

  const handleUploadRef = useRef(handleUpload);
  handleUploadRef.current = handleUpload;

  function takeImageFromDataTransfer(data: DataTransfer | null) {
    if (!data) {
      return false;
    }

    const files: File[] = [];
    for (const item of Array.from(data.items)) {
      if (
        item.kind === "file" &&
        (item.type.startsWith("image/") || item.type.startsWith("video/"))
      ) {
        const file = item.getAsFile();
        if (file) {
          files.push(file);
        }
      }
    }
    if (files.length === 0) {
      for (const file of Array.from(data.files)) {
        if (
          file.type.startsWith("image/") ||
          file.type.startsWith("video/") ||
          /\.(png|jpe?g|webp|gif|mp4|webm|mov|m4v)$/i.test(file.name)
        ) {
          files.push(file);
        }
      }
    }
    if (files.length === 0) {
      return false;
    }
    void handleUploadMany(files);
    return true;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const payload: Record<string, string | number | string[] | null | undefined> = {
      name: values.name,
      description: values.description,
      imageUrl: imageUrls[0] || undefined,
      imageUrls,
      listPrice:
        values.listPrice.trim() === "" ? null : Number(values.listPrice),
      stock: Number(values.stock),
      weightGrams:
        values.weightGrams.trim() === "" ? null : Number(values.weightGrams),
      widthMm: values.widthMm.trim() === "" ? null : Number(values.widthMm),
      heightMm: values.heightMm.trim() === "" ? null : Number(values.heightMm),
      depthMm: values.depthMm.trim() === "" ? null : Number(values.depthMm),
      catalogLine: values.catalogLine,
      zeroStockMode: values.zeroStockMode,
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
      <div className="space-y-2">
        <span className="text-sm font-medium">Направление витрины</span>
        <p className="text-sm text-[var(--muted)]">
          Товар попадёт в раздел «Сувениры» или «Для дома» на публичной витрине.
        </p>
        <div className="flex flex-wrap gap-2">
          {CATALOG_LINES.map((line) => {
            const selected = values.catalogLine === line;
            return (
              <button
                key={line}
                type="button"
                onClick={() =>
                  setValues((current) => ({ ...current, catalogLine: line }))
                }
                className={`rounded-full px-3 py-2 text-sm font-medium transition ${
                  selected
                    ? "bg-[var(--brand)] text-white"
                    : "border border-[var(--border)] bg-white text-[var(--text)] hover:bg-[var(--bg)]"
                }`}
              >
                {CATALOG_LINE_LABELS[line]}
              </button>
            );
          })}
        </div>
      </div>
      {categories.length > 0 ? (
        <div className="space-y-2">
          <span className="text-sm font-medium">Разделы витрины</span>
          <p className="text-sm text-[var(--muted)]">
            Можно выбрать несколько. Клиент фильтрует по ним внутри выбранного направления.
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
        <span className="text-sm font-medium">Фото, GIF и видео</span>
        <p className="text-sm text-[var(--muted)]">
          До {MAX_PRODUCT_IMAGES} файлов. Первое — обложка. JPEG, PNG, WebP, GIF
          (до 8 МБ) или MP4/WebM/MOV (до 40 МБ) — видео само станет GIF (первые 8
          сек).
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,.jpg,.jpeg,.png,.webp,.gif,.mp4,.webm,.mov,.m4v"
          multiple
          className="hidden"
          onChange={(event) => {
            if (event.target.files?.length) {
              void handleUploadMany(event.target.files);
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
            if (event.dataTransfer.files?.length) {
              void handleUploadMany(event.dataTransfer.files);
            }
          }}
          className={`rounded-xl border border-dashed p-4 transition outline-none focus:border-[var(--brand)] ${
            dragOver
              ? "border-[var(--brand)] bg-[var(--brand-soft)]"
              : "border-[var(--border)] bg-[var(--bg)]"
          }`}
        >
          {imageUrls.length > 0 ? (
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {imageUrls.map((url, index) => (
                <div
                  key={`${url}-${index}`}
                  className="overflow-hidden rounded-xl border border-[var(--border)] bg-white"
                >
                  <ProductPhoto
                    src={url}
                    alt={`Фото ${index + 1}`}
                    frameClassName="aspect-square h-auto"
                  />
                  <div className="space-y-1 border-t border-[var(--border)] p-2">
                    <p className="text-xs text-[var(--muted)]">
                      {index === 0 ? "Обложка" : `Фото ${index + 1}`}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {index > 0 ? (
                        <button
                          type="button"
                          className="text-xs text-[var(--brand)] hover:underline"
                          onClick={() => {
                            const next = [...imageUrls];
                            const [item] = next.splice(index, 1);
                            if (item) {
                              next.unshift(item);
                              setImageUrls(next);
                            }
                          }}
                        >
                          В обложку
                        </button>
                      ) : null}
                      {index > 0 ? (
                        <button
                          type="button"
                          className="text-xs text-[var(--muted)] hover:underline"
                          onClick={() => {
                            const next = [...imageUrls];
                            const tmp = next[index - 1]!;
                            next[index - 1] = next[index]!;
                            next[index] = tmp;
                            setImageUrls(next);
                          }}
                        >
                          ←
                        </button>
                      ) : null}
                      {index < imageUrls.length - 1 ? (
                        <button
                          type="button"
                          className="text-xs text-[var(--muted)] hover:underline"
                          onClick={() => {
                            const next = [...imageUrls];
                            const tmp = next[index + 1]!;
                            next[index + 1] = next[index]!;
                            next[index] = tmp;
                            setImageUrls(next);
                          }}
                        >
                          →
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:underline"
                        onClick={() =>
                          setImageUrls(imageUrls.filter((_, i) => i !== index))
                        }
                      >
                        Убрать
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mb-4 flex h-32 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--brand-soft)]/35 text-sm text-[var(--muted)]">
              Нет фото
            </div>
          )}
          <div className="space-y-2">
            <Button
              type="button"
              variant="secondary"
              disabled={uploading || imageUrls.length >= MAX_PRODUCT_IMAGES}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading
                ? "Загрузка..."
                : imageUrls.length > 0
                  ? "Добавить ещё"
                  : "Загрузить фото / GIF / видео"}
            </Button>
            <p className="text-sm text-[var(--muted)]">
              Ctrl+V в зону, перетаскивание или выбор файлов. Видео конвертируется
              в GIF на сервере — подождите.
            </p>
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
      <div className="space-y-2">
        <span className="text-sm font-medium">Если остаток 0</span>
        <p className="text-sm text-[var(--muted)]">
          Как показывать товар на витрине, когда его нет.
        </p>
        <div className="flex flex-wrap gap-2">
          {ZERO_STOCK_MODES.map((mode) => {
            const selected = values.zeroStockMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() =>
                  setValues((current) => ({ ...current, zeroStockMode: mode }))
                }
                className={`rounded-full px-3 py-2 text-sm font-medium transition ${
                  selected
                    ? "bg-[var(--brand)] text-white"
                    : "border border-[var(--border)] bg-white text-[var(--text)] hover:bg-[var(--bg)]"
                }`}
                title={ZERO_STOCK_MODE_HINTS[mode]}
              >
                {ZERO_STOCK_MODE_LABELS[mode]}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-[var(--muted)]">
          {ZERO_STOCK_MODE_HINTS[values.zeroStockMode]}
        </p>
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
      {notice ? <p className="text-sm text-green-700">{notice}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="submit" disabled={loading || uploading}>
        {loading ? "Сохранение..." : uploading ? "Загрузка файла..." : "Сохранить"}
      </Button>
    </form>
  );
}

export type ProductFormValues = {
  id?: string;
  name: string;
  description: string;
  imageUrl: string;
  imageUrls: string[];
  costPrice: string;
  listPrice: string;
  stock: string;
  weightGrams: string;
  widthMm: string;
  heightMm: string;
  depthMm: string;
  catalogLine: CatalogLine;
  zeroStockMode: ZeroStockMode;
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
