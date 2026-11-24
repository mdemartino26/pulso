/*
 * Service worker de Pulso.
 *
 * Reglas (pensadas para convivir con la CSP con nonce y con datos de salud):
 * 1. NUNCA se cachea HTML ni datos: cada página trae un nonce nuevo en su
 *    CSP y contenido privado del usuario. Las navegaciones van siempre a la
 *    red; si no hay conexión se muestra /offline.html.
 * 2. Solo se cachean assets públicos e inmutables (/_next/static tiene hash
 *    en el nombre) y los íconos. Nada de esto contiene datos del usuario,
 *    así que en un dispositivo compartido no queda información personal.
 * 3. No se intercepta nada que no sea GET del mismo origen (Server Actions,
 *    /api, Supabase y otros dominios pasan directo).
 */

const VERSION = "v1";
const STATIC_CACHE = `pulso-static-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/offline.css", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== STATIC_CACHE).map((key) => caches.delete(key)),
      );
      // Navigation preload: el navegador pide la página en paralelo mientras
      // arranca el service worker, así no suma latencia.
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })(),
  );
});

function isCacheableAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    PRECACHE.includes(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const preloaded = await event.preloadResponse;
          if (preloaded) return preloaded;
          return await fetch(request);
        } catch {
          const offline = await caches.match(OFFLINE_URL);
          return offline ?? Response.error();
        }
      })(),
    );
    return;
  }

  if (isCacheableAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok && response.type === "basic") {
          await cache.put(request, response.clone());
        }
        return response;
      })(),
    );
  }
  // Todo lo demás (RSC, /api, manifest, etc.): el navegador lo maneja normal.
});
