"use client";

import { useEffect } from "react";

let lockCount = 0;
let previousOverflow = "";

function lockScroll() {
  if (typeof document === "undefined") {
    return;
  }

  if (lockCount === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  lockCount += 1;
}

function unlockScroll() {
  if (typeof document === "undefined") {
    return;
  }

  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = previousOverflow;
    previousOverflow = "";
  }
}

/** Блокирует прокрутку страницы, пока `locked === true`. Безопасно для вложенных модалок. */
export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) {
      return;
    }

    lockScroll();
    return () => {
      unlockScroll();
    };
  }, [locked]);
}
