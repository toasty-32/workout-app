/* Workout PWA service worker
   Strategy:
   - HTML/navigation  -> network-first (always get the newest index.html when online,
                         fall back to cache when offline). This is what makes app
                         updates appear automatically with no manual cache clearing.
   - other assets     -> stale-while-revalidate (instant from cache, refresh in background)
   Bump VERSION whenever you want to force a clean cache wipe. */

const VERSION = "v3";
const CACHE = `workout-${VERSION}`;
const ASSETS = ["./", "./index.html", "./manifest.json"];

// Install: precache the app shell, then take over immediately
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

// Activate: delete any old-version caches, then control open pages
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  const isHTML =
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");

  // ── Network-first for the app HTML ──
  if (isHTML) {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put("./index.html", copy));
          return res;
        })
        .catch(() =>
          caches.match("./index.html").then(r => r || caches.match("./"))
        )
    );
    return;
  }

  // ── Stale-while-revalidate for everything else ──
  e.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req)
        .then(res => {
          if (res && res.status === 200 && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

// Allow the page to tell a waiting worker to activate right away
self.addEventListener("message", e => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});
