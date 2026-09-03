export type CategoryOption = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  active: boolean;
};

export type CatalogCategory = {
  id: string;
  name: string;
  slug: string;
};

const CYRILLIC_MAP: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

export function slugifyCategoryName(name: string): string {
  const lowered = name.trim().toLowerCase();
  let result = "";

  for (const char of lowered) {
    if (CYRILLIC_MAP[char] !== undefined) {
      result += CYRILLIC_MAP[char];
      continue;
    }
    if (/[a-z0-9]/.test(char)) {
      result += char;
      continue;
    }
    if (/\s|-|_/.test(char)) {
      result += "-";
    }
  }

  return result.replace(/-+/g, "-").replace(/^-|-$/g, "") || "category";
}

export function parseCategoryIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const ids = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);

  return [...new Set(ids)];
}
