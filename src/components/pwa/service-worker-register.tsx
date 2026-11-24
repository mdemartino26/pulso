"use client";

import { useEffect } from "react";

/**
 * Registra /sw.js. Solo en producción: en desarrollo un service worker
 * cacheando chunks genera confusiones con el hot reload.
 *
 * El registro lo hace este script (que ya cargó con nonce), y la CSP de la
 * página permite el worker gracias a `worker-src 'self'`.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {
        // Sin service worker la app funciona igual; no mostramos nada.
      });
  }, []);

  return null;
}
