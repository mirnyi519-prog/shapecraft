"use client";

import { useState } from "react";
import { formatRub } from "@/lib/calculations";
import {
  HUNTING_TIERS,
  priceForTier,
  type HuntingPriceList,
  type HuntingTier,
} from "@/lib/hunting-shared";
import { chromeTab } from "@/components/ui";

export function HuntingPrices({ prices }: { prices: HuntingPriceList }) {
  const [tier, setTier] = useState<HuntingTier>("member");
  const active = HUNTING_TIERS.find((item) => item.id === tier)!;

  const sections: { name: string; rows: HuntingPriceList["rows"] }[] = [];
  for (const row of prices.rows) {
    const last = sections.at(-1);
    if (last && last.name === row.section) {
      last.rows.push(row);
    } else {
      sections.push({ name: row.section, rows: [row] });
    }
  }

  return (
    <div className="space-y-4">
      <div className="chrome-tabs in-card">
        {HUNTING_TIERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTier(item.id)}
            className={chromeTab(item.id === tier)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className="text-sm text-[var(--muted)]">{active.hint}</p>

      {sections.map((section) => (
        <div key={section.name} className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            {section.name}
          </h3>
          <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
            {section.rows.map((row) => {
              const price = priceForTier(row.prices, tier);
              return (
                <li key={`${section.name}-${row.label}`} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span>
                    {row.label}
                    <span className="ml-2 text-xs text-[var(--muted)]">{row.unit}</span>
                  </span>
                  <span className="shrink-0 font-semibold">
                    {price != null ? (
                      `${tier === "guest" ? "от " : ""}${formatRub(price)}`
                    ) : (
                      <span className="text-sm font-normal text-[var(--muted)]">
                        {row.prices[2] != null && (tier === "member" || tier === "member-dogs")
                          ? "только со спецвзносом"
                          : "уточнить"}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {prices.notes.length > 0 ? (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-[var(--brand)]">Примечания к прейскуранту</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[var(--muted)]">
            {prices.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
