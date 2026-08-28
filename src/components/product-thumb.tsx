import Image from "next/image";

export function ProductThumb({
  src,
  alt,
  size = 40,
}: {
  src: string | null | undefined;
  alt: string;
  size?: number;
}) {
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-lg bg-[var(--bg)]"
      style={{ width: size, height: size }}
    >
      {src ? (
        <Image src={src} alt={alt} fill className="object-cover" sizes={`${size}px`} />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[10px] text-[var(--muted)]">
          —
        </div>
      )}
    </div>
  );
}
