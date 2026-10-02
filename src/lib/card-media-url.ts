/** Адрес уменьшенной копии. Без Node-модулей — можно импортировать из витрины. */
export function cardMediaUrl(src: string | null | undefined): string | null {
  if (!src?.trim()) {
    return null;
  }
  const raw = src.trim();
  if (!raw.includes("/api/media/")) {
    return raw;
  }
  const hashIndex = raw.indexOf("#");
  const withoutHash = hashIndex >= 0 ? raw.slice(0, hashIndex) : raw;
  const hash = hashIndex >= 0 ? raw.slice(hashIndex) : "";
  const [pathPart, queryPart] = withoutHash.split("?");
  const params = new URLSearchParams(queryPart ?? "");
  params.set("v", "card");
  return `${pathPart}?${params.toString()}${hash}`;
}
