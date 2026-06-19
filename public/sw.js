/*
 * InstrumentHub Studio — service worker (hand-written, versioned).
 *
 * Strategy:
 *   - Precache the app shell AND the build's hashed JS/CSS (injected at build
 *     time, see scripts/inject-precache.mjs) so the whole app works offline
 *     after the first load.
 *   - Navigations: network-first, fall back to cached index when offline.
 *   - Other same-origin GETs: stale-while-revalidate.
 *   Bump VERSION to invalidate old caches.
 */
const VERSION = "ihs-v1";
const CACHE = `instrumenthub-${VERSION}`;
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./favicon.svg", "./icons/icon-192.png", "./icons/icon-512.png"];
const INJECTED = [/*__PRECACHE__*/];
const PRECACHE = [...SHELL, ...INJECTED];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).catch(() => {}));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        (await caches.open(CACHE)).put("./index.html", fresh.clone());
        return fresh;
      } catch {
        return (await caches.match("./index.html")) || (await caches.match("./")) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    const network = fetch(request).then((res) => {
      if (res && res.ok) caches.open(CACHE).then((c) => c.put(request, res.clone()));
      return res;
    }).catch(() => null);
    return cached || (await network) || Response.error();
  })());
});
