// Service worker minimo: rende IPA Monitor installabile e apre l'interfaccia anche con rete lenta.
// I dati (Supabase) non passano mai dalla cache: devono essere sempre freschi.
const CACHE = "ipa-monitor-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches.keys()
      .then((k) => Promise.all(k.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  ),
);

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  // Prima la rete (così ogni deploy arriva subito), la cache solo se offline.
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        if (r.ok) {
          const copia = r.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copia));
        }
        return r;
      })
      .catch(() => caches.match(e.request).then((r) => r ?? caches.match("./"))),
  );
});
