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
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
      <div
        className={`grid gap-0 ${hasImage ? "md:grid-cols-[1.15fr_1fr]" : ""}`}
      >
        {hasImage ? (
          <div className="min-h-44 bg-[var(--bg)] md:min-h-56">
            <ProductPhoto
              src={banner.imageUrl}
              alt={title || "Баннер ShapeCraft"}
              frameClassName="h-full min-h-44 rounded-none md:min-h-56"
            />
          </div>
        ) : null}
        <div className="flex flex-col justify-center space-y-2 p-5 sm:p-6">
          {title ? <h2 className="text-xl font-bold sm:text-2xl">{title}</h2> : null}
          {text ? (
            <p className="whitespace-pre-wrap text-sm text-[var(--muted)] sm:text-base">
              {text}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
