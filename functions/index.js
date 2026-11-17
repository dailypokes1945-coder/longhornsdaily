// GET / — the front page with today's headlines already in the HTML (for search
// engines and link previews). If anything goes wrong, serves the plain page, which
// fills itself in from /api/site in the browser as before.
import { loadSite } from "./_lib.js";
import { SEED } from "./_seed.js";
import { renderPage, mergeSite } from "./_render.js";
import { maybeSnapshot } from "./_archive.js";

const TTL = 30; // seconds; matches /api/site, so a Publish shows up within about 30s

async function assetJson(env, origin, path) {
  try {
    const r = await env.ASSETS.fetch(new Request(origin + path));
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

export async function onRequest(context) {
  const { request, env, next } = context;
  if (request.method !== "GET" && request.method !== "HEAD") return next();
  const url = new URL(request.url);

  // One cached copy for every variant of "/" (?x=1, ?src=card, …)
  const cache = typeof caches !== "undefined" ? caches.default : null;
  const cacheKey = new Request(url.origin + "/__ssr_home", { method: "GET" });
  if (cache) {
    const hit = await cache.match(cacheKey);
    if (hit) return request.method === "HEAD" ? new Response(null, hit) : hit;
  }

  const plain = await env.ASSETS.fetch(new Request(url.origin + "/"));
  if (!plain.ok) return plain;
  try {
    const [template, site, auto, history, overrides] = await Promise.all([
      plain.clone().text(),
      loadSite(env, SEED),
      assetJson(env, url.origin, "/auto.json"),
      assetJson(env, url.origin, "/history.json"),
      assetJson(env, url.origin, "/overrides.json")
    ]);
    const html = renderPage(template, site, auto, history, new Date(), overrides);
    const res = new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": `public, max-age=${TTL}`,
        "x-content-type-options": "nosniff",
        "referrer-policy": "strict-origin-when-cross-origin",
        "x-frame-options": "DENY"
      }
    });
    if (cache) context.waitUntil(cache.put(cacheKey, res.clone()));
    // Save today's front page for the daily archive (at most once an hour)
    context.waitUntil(maybeSnapshot(env, mergeSite(site, auto, overrides)));
    return request.method === "HEAD" ? new Response(null, res) : res;
  } catch (e) {
    return plain;
  }
}
