type ProductPhotoProps = {
  src: string | null | undefined;
  alt: string;
  className?: string;
  /** высота контейнера, например h-48 */
  frameClassName?: string;
  /** Для LCP-картинки (баннер / первый экран). */
  priority?: boolean;
};

/**
 * Фото целиком (object-contain).
 * Пустоты — размытый фон через CSS background (тот же URL, без второй загрузки).
 */
export function ProductPhoto({
  src,
  alt,
  className = "",
  frameClassName = "h-48",
  priority = false,
}: ProductPhotoProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-[var(--brand-soft)]/35 ${frameClassName} ${className}`}
    >
      {src ? (
        <>
          <div
            aria-hidden
            className="absolute inset-0 scale-110 bg-cover bg-center opacity-35 blur-xl"
            style={{ backgroundImage: `url(${JSON.stringify(src)})` }}
          />
          <div className="absolute inset-0 bg-white/25" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={priority ? "high" : "auto"}
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
