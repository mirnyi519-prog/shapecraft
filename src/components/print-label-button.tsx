"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui";

export function PrintLabelButton({ auto = false }: { auto?: boolean }) {
  useEffect(() => {
    if (!auto) {
      return;
    }
    const timer = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(timer);
  }, [auto]);

  return (
    <Button type="button" className="no-print min-h-11" onClick={() => window.print()}>
      Печать
    </Button>
  );
}
