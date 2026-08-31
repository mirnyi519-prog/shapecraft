"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { FeedbackModal } from "@/components/feedback-modal";

export function FeedbackForm() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex justify-center pt-2">
        <Button type="button" className="min-h-11 px-6" onClick={() => setOpen(true)}>
          Обратная связь
        </Button>
      </div>
      <FeedbackModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
