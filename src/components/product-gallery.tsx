"use client";

import { useEffect, useState } from "react";
import { ProductPhoto } from "@/components/product-photo";

type ProductGalleryProps = {
  images: string[];
  alt: string;
  frameClassName?: string;
};

/**
 * Главное фото + миниатюры. GIF анимируются (через <img>).
 */
export function ProductGallery({
  images,
  alt,
  frameClassName = "aspect-[4/3] h-auto min-h-56",
}: ProductGalleryProps) {
  const list = images.filter((url) => Boolean(url?.trim()));
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
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
      <ProductPhoto
        src={current}
        alt={alt}
        frameClassName={frameClassName}
      />
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
    </div>
  );
}
