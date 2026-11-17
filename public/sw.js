// Longhorns Daily service worker.
// Minimal on purpose: it lets browsers offer "Add to Home Screen" but caches
// nothing, so headlines are always fresh.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
