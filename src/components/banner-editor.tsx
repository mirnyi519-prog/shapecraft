"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ProductPhoto } from "@/components/product-photo";
import { Badge, Button, Card, Input, Textarea } from "@/components/ui";
import type { StoreBannerView } from "@/lib/banner";

export function BannerEditor({ initial }: { initial: StoreBannerView }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(initial.title);
  const [text, setText] = useState(initial.text);
  const [imageUrl, setImageUrl] = useState(initial.imageUrl ?? "");
  const [active, setActive] = useState(initial.active);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

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
    formData.append("file", file);

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
      setImageUrl(data.url);
    } catch {
      setError("Не удалось загрузить фото");
    }
    setUploading(false);
  }

  async function save(nextActive = active) {
    setLoading(true);
    setError("");
    setMessage("");

    const response = await fetch("/api/banner", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        text,
        imageUrl: imageUrl || null,
        active: nextActive,
      }),
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Ошибка сохранения");
      setLoading(false);
      return;
    }

    setActive(nextActive);
    setMessage(nextActive ? "Баннер сохранён и показан на витрине" : "Баннер сохранён");
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card title="Содержание баннера">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={active ? "success" : "neutral"}>
              {active ? "На витрине" : "Скрыт"}
            </Badge>
            <p className="text-sm text-[var(--muted)]">
              Заголовок, текст и картинка. Можно включить или убрать с витрины.
            </p>
          </div>

          <Input
            label="Заголовок"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Например: Хэллоуинская коллекция"
          />
          <Textarea
            label="Текст"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Короткое сообщение для посетителей витрины"
          />

          <div className="space-y-2">
            <span className="text-sm font-medium">Картинка</span>
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <div className="w-full max-w-sm shrink-0">
                <ProductPhoto
                  src={imageUrl || null}
                  alt="Баннер"
                  frameClassName="aspect-[16/9] h-auto min-h-36"
                />
              </div>
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? "Загрузка..." : "Загрузить картинку"}
                </Button>
                {imageUrl ? (
                  <button
                    type="button"
                    className="block text-sm text-red-600 hover:underline"
                    onClick={() => setImageUrl("")}
                  >
                    Убрать картинку
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {message ? <p className="text-sm text-green-700">{message}</p> : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              className="min-h-11 flex-1"
              disabled={loading || uploading}
              onClick={() => void save(true)}
            >
              {loading ? "Сохранение..." : "Сохранить и показать на витрине"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="min-h-11 flex-1"
              disabled={loading || uploading}
              onClick={() => void save(false)}
            >
              Сохранить и скрыть
            </Button>
          </div>
        </div>
      </Card>

      <Card title="Предпросмотр">
        {!title.trim() && !text.trim() && !imageUrl ? (
          <p className="text-[var(--muted)]">Пока пусто — заполните поля выше.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg)]">
            <div className="grid gap-0 md:grid-cols-[1.1fr_1fr]">
              {imageUrl ? (
                <div className="min-h-40 bg-white md:min-h-52">
                  <ProductPhoto
                    src={imageUrl}
                    alt={title || "Баннер"}
                    frameClassName="h-full min-h-40 rounded-none md:min-h-52"
                  />
                </div>
              ) : null}
              <div className="space-y-2 p-5">
                {title.trim() ? (
                  <h3 className="text-xl font-bold">{title.trim()}</h3>
                ) : null}
                {text.trim() ? (
                  <p className="whitespace-pre-wrap text-sm text-[var(--muted)]">
                    {text.trim()}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
