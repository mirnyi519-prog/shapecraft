"use client";

import { Button } from "@/components/ui";

type ExportScope = "current" | "settlement";

export function PartnerExportButton({
  scope,
  settlementId,
  label,
  variant = "secondary",
}: {
  scope: ExportScope;
  settlementId?: string;
  label: string;
  variant?: "primary" | "secondary" | "danger";
}) {
  function handleExport() {
    const params = new URLSearchParams();
    if (scope === "current") {
      params.set("period", "current");
    } else if (settlementId) {
      params.set("settlementId", settlementId);
    }
    window.location.href = `/api/settlements/export?${params.toString()}`;
  }

  return (
    <Button type="button" variant={variant} onClick={handleExport}>
      {label}
    </Button>
  );
}
