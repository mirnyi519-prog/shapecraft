type ProductPhotoProps = {
  src: string | null | undefined;
  alt: string;
  className?: string;
  /** высота контейнера, например h-48 */
  frameClassName?: string;
};

/**
 * Фото целиком (object-contain).
 * Пустоты — размытый полупрозрачный фон из той же картинки.
 */
export function ProductPhoto({
  src,
  alt,
  className = "",
  frameClassName = "h-48",
}: ProductPhotoProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-[var(--brand-soft)]/35 ${frameClassName} ${className}`}
    >
      {src ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-35 blur-xl"
          />
          <div className="absolute inset-0 bg-white/25" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="relative z-10 h-full w-full object-contain p-2"
          />
        </>
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
          Нет фото
        </div>
      )}
    </div>
  );
}
