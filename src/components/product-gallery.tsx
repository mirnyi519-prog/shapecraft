"use client";

import { useEffect, useState } from "react";
import { ProductLightbox } from "@/components/product-lightbox";
import { ProductPhoto } from "@/components/product-photo";

type ProductGalleryProps = {
  images: string[];
  alt: string;
  frameClassName?: string;
};

/**
 * Главное фото + миниатюры. Тап по фото — на весь экран.
 * GIF анимируются (через <img>).
 */
export function ProductGallery({
  images,
  alt,
  frameClassName = "aspect-[4/3] h-auto min-h-56",
}: ProductGalleryProps) {
  const list = images.filter((url) => Boolean(url?.trim()));
  const [index, setIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    setIndex(0);
    setLightboxOpen(false);
  }, [list.join("|")]);

  if (list.length === 0) {
    return (
      <ProductPhoto src={null} alt={alt} frameClassName={frameClassName} />
    );
  }

  const safeIndex = Math.min(index, list.length - 1);
  const current = list[safeIndex]!;

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setLightboxOpen(true)}
        className="group relative block w-full cursor-zoom-in text-left"
        aria-label={`Открыть фото «${alt}» на весь экран`}
      >
        <ProductPhoto
          src={current}
          alt={alt}
          frameClassName={frameClassName}
        />
        <span className="pointer-events-none absolute bottom-3 right-3 z-20 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white opacity-90 backdrop-blur-sm transition group-hover:opacity-100">
          <ExpandIcon />
          На весь экран
        </span>
      </button>
      {list.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {list.map((url, i) => {
            const active = i === safeIndex;
            return (
              <button
                key={`${url}-${i}`}
                type="button"
                onClick={() => setIndex(i)}
                className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 bg-[var(--bg)] ${
                  active
                    ? "border-[var(--brand)]"
                    : "border-transparent opacity-80 hover:opacity-100"
                }`}
                aria-label={`Фото ${i + 1}`}
                aria-current={active ? "true" : undefined}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </button>
            );
          })}
        </div>
      ) : null}

      <ProductLightbox
        images={list}
        alt={alt}
        index={safeIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onIndexChange={setIndex}
      />
    </div>
  );
}

function ExpandIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-3.5 w-3.5"
      aria-hidden
    >
      <path d="M3 7V3h4v2H5v2H3zm10-4h4v4h-2V5h-2V3zM3 13h2v2h2v2H3v-4zm14 4h-4v-2h2v-2h2v4z" />
    </svg>
  );
}
