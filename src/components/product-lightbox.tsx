"use client";

import { useEffect, useRef, useState } from "react";
import { useScrollLock } from "@/hooks/use-scroll-lock";

type ProductLightboxProps = {
  images: string[];
  alt: string;
  index: number;
  open: boolean;
  onClose: () => void;
  onIndexChange: (index: number) => void;
};

/**
 * Полноэкранный просмотр фото товара: листание, Escape, safe-area.
 */
export function ProductLightbox({
  images,
  alt,
  index,
  open,
  onClose,
  onIndexChange,
}: ProductLightboxProps) {
  const list = images.filter((url) => Boolean(url?.trim()));
  const safeIndex = list.length === 0 ? 0 : Math.min(index, list.length - 1);
  const current = list[safeIndex];
  const touchX = useRef<number | null>(null);
  const [hintVisible, setHintVisible] = useState(true);

  useScrollLock(open);

  useEffect(() => {
    if (!open) {
      return;
    }
    setHintVisible(true);
    const timer = window.setTimeout(() => setHintVisible(false), 2200);
    return () => window.clearTimeout(timer);
  }, [open, safeIndex]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        onClose();
        return;
      }
      if (event.key === "ArrowLeft" && list.length > 1) {
        event.preventDefault();
        event.stopImmediatePropagation();
        onIndexChange((safeIndex - 1 + list.length) % list.length);
        return;
      }
      if (event.key === "ArrowRight" && list.length > 1) {
        event.preventDefault();
        event.stopImmediatePropagation();
        onIndexChange((safeIndex + 1) % list.length);
      }
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, list.length, safeIndex, onClose, onIndexChange]);

  if (!open || !current) {
    return null;
  }

  function goPrev() {
    if (list.length < 2) {
      return;
    }
    onIndexChange((safeIndex - 1 + list.length) % list.length);
  }

  function goNext() {
    if (list.length < 2) {
      return;
    }
    onIndexChange((safeIndex + 1) % list.length);
  }

  return (
    <div
      className="safe-overlay fixed inset-0 z-[80] flex flex-col bg-black/95"
      role="dialog"
      aria-modal="true"
      aria-label={`Фото: ${alt}`}
      onClick={onClose}
    >
      <div
        className="flex items-center justify-between gap-3 px-3 pb-2 pt-3"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="min-w-0 truncate text-sm font-medium text-white/90">
          {alt}
          {list.length > 1 ? (
            <span className="ml-2 text-white/55">
              {safeIndex + 1} / {list.length}
            </span>
          ) : null}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть фото"
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/10 px-3.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
        >
          Закрыть
        </button>
      </div>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center px-2"
        onClick={(event) => event.stopPropagation()}
        onTouchStart={(event) => {
          touchX.current = event.changedTouches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          const start = touchX.current;
          touchX.current = null;
          if (start == null || list.length < 2) {
            return;
          }
          const end = event.changedTouches[0]?.clientX;
          if (end == null) {
            return;
          }
          const delta = end - start;
          if (Math.abs(delta) < 48) {
            return;
          }
          if (delta > 0) {
            goPrev();
          } else {
            goNext();
          }
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current}
          alt={alt}
          className="max-h-full max-w-full object-contain select-none"
          draggable={false}
        />

        {list.length > 1 ? (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label="Предыдущее фото"
              className="absolute left-1 top-1/2 hidden min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25 sm:inline-flex"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Следующее фото"
              className="absolute right-1 top-1/2 hidden min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25 sm:inline-flex"
            >
              ›
            </button>
          </>
        ) : null}

        {hintVisible && list.length > 1 ? (
          <p className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1.5 text-xs text-white/80 sm:hidden">
            Свайпните для листания
          </p>
        ) : null}
      </div>

      {list.length > 1 ? (
        <div
          className="flex justify-center gap-2 overflow-x-auto px-4 pb-3 pt-2"
          onClick={(event) => event.stopPropagation()}
        >
          {list.map((url, i) => {
            const active = i === safeIndex;
            return (
              <button
                key={`${url}-${i}`}
                type="button"
                onClick={() => onIndexChange(i)}
                className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 ${
                  active ? "border-white" : "border-transparent opacity-60"
                }`}
                aria-label={`Фото ${i + 1}`}
                aria-current={active ? "true" : undefined}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
              </button>
            );
          })}
        </div>
      ) : (
        <div className="pb-3" />
      )}
    </div>
  );
}
