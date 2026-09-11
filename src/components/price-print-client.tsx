"use client";

import { Button } from "@/components/ui";

export function PricePrintClient() {
  return (
    <Button
      type="button"
      className="min-h-11 w-full sm:w-auto"
      onClick={() => {
        window.print();
      }}
    >
      Печать
    </Button>
  );
}
