"use client";

import { useEffect } from "react";

/**
 * Запасной учёт визита с браузера.
 * Middleware может потерять заход (Caddy/loopback); beacon идёт обычным
 * запросом клиента → реальный IP и UA.
 */
export function VisitBeacon({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }

    const path = window.location.pathname;
    if (path !== "/") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const body = JSON.stringify({
      path,
      referer: document.referrer || null,
      utmSource: params.get("utm_source"),
      utmMedium: params.get("utm_medium"),
      utmCampaign: params.get("utm_campaign"),
    });

    const send = () => {
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        const blob = new Blob([body], { type: "application/json" });
        if (navigator.sendBeacon("/api/visits/track", blob)) {
          return;
        }
      }
      void fetch("/api/visits/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    };

    send();
  }, [enabled]);

  return null;
}
