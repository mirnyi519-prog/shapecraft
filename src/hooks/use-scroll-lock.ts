"use client";

import { useEffect } from "react";

type ScrollSnapshot = {
  overflow: string;
  position: string;
  top: string;
  left: string;
  right: string;
  width: string;
  paddingRight: string;
  htmlOverflow: string;
  htmlOverscroll: string;
  scrollY: number;
};

let lockCount = 0;
let snapshot: ScrollSnapshot | null = null;

function lockScroll() {
  if (typeof document === "undefined") {
    return;
  }

  if (lockCount === 0) {
    const scrollY = window.scrollY;
    const scrollbarGap = Math.max(0, window.innerWidth - document.documentElement.clientWidth);

    snapshot = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      left: document.body.style.left,
      right: document.body.style.right,
      width: document.body.style.width,
      paddingRight: document.body.style.paddingRight,
      htmlOverflow: document.documentElement.style.overflow,
      htmlOverscroll: document.documentElement.style.overscrollBehavior,
      scrollY,
    };

    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "none";
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    if (scrollbarGap > 0) {
      document.body.style.paddingRight = `${scrollbarGap}px`;
    }
  }
  lockCount += 1;
}

function unlockScroll() {
  if (typeof document === "undefined") {
    return;
  }

  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0 && snapshot) {
    const { scrollY, ...styles } = snapshot;
    document.documentElement.style.overflow = styles.htmlOverflow;
    document.documentElement.style.overscrollBehavior = styles.htmlOverscroll;
    document.body.style.overflow = styles.overflow;
    document.body.style.position = styles.position;
    document.body.style.top = styles.top;
    document.body.style.left = styles.left;
    document.body.style.right = styles.right;
    document.body.style.width = styles.width;
    document.body.style.paddingRight = styles.paddingRight;
    snapshot = null;
    window.scrollTo(0, scrollY);
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
