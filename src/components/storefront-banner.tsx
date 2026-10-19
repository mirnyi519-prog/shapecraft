import type { StoreBannerView } from "@/lib/banner";
import { ProductPhoto } from "@/components/product-photo";

export function StorefrontBanner({ banner }: { banner: StoreBannerView }) {
  const title = banner.title.trim();
  const text = banner.text.trim();
  const hasImage = Boolean(banner.imageUrl);

  if (!title && !text && !hasImage) {
    return null;
  }

  return (
    <section className="overflow-hidden rounded-2xl border sm:rounded-3xl border-[var(--border)]/60 bg-white/70 shadow-none backdrop-blur-sm">
      <div
        className={`grid gap-0 ${hasImage ? "md:grid-cols-[1.2fr_1fr]" : ""}`}
      >
        {hasImage ? (
          <div className="hidden bg-[var(--brand-soft)]/40 md:block md:min-h-48">
            <ProductPhoto
              src={banner.imageUrl}
              alt={title || "Баннер ShapeCraft"}
              frameClassName="h-full min-h-40 rounded-none md:min-h-48"
              priority
            />
          </div>
        ) : null}
        <div className="flex flex-col justify-center space-y-1 px-4 py-3 sm:space-y-2 sm:p-6">
          {title ? (
            <h2 className="text-lg font-bold tracking-tight sm:text-2xl">
              {title}
            </h2>
          ) : null}
          {text ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--muted)] sm:text-base">
              {text}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
