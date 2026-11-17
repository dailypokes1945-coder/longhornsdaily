// Shared helpers for the API functions.

export const SLOTS = ["banner", "feature", "top", "left", "center", "right"];
const KEY = "site";

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extra }
  });
}

export async function loadSite(env, seed) {
  if (!env.SITE) return seed;
  const raw = await env.SITE.get(KEY);
  return raw ? JSON.parse(raw) : seed;
}

export async function saveSite(env, site) {
  await env.SITE.put(KEY, JSON.stringify(site));
}

function cleanUrl(u) {
  if (typeof u !== "string" || !u) return "";
  try {
    const x = new URL(u.trim());
    return x.protocol === "http:" || x.protocol === "https:" ? x.href : "";
  } catch { return ""; }
}
const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// Optional "big game" graphic: two teams, ranks, and a when/where line.
function cleanMatchup(m) {
  if (!m || typeof m !== "object") return null;
  const left = str(m.left, 40), right = str(m.right, 40);
  if (!left || !right) return null;
  return { left, leftRank: str(m.leftRank, 6), right, rightRank: str(m.rightRank, 6), when: str(m.when, 100) };
}

// Optional photo: a file in the site's /img/ folder, or a full https link.
function cleanImage(u) {
  if (typeof u !== "string") return "";
  const v = u.trim();
  if (/^\/img\/[a-zA-Z0-9._-]+$/.test(v)) return v;
  if (/^\/photos\/[a-z0-9]+\.(jpg|png|webp|gif)$/.test(v)) return v;
  const url = cleanUrl(v);
  return url.startsWith("https://") ? url : "";
}

// Optional embedded post: an X/Twitter post or a Facebook video, shown through the
// platform's own embed (photos/video, credit and link back included).
function cleanEmbed(u) {
  const url = cleanUrl(u);
  if (!url) return "";
  const x = new URL(url);
  const host = x.hostname.replace(/^(www|m|mobile)\./, "");
  if (["x.com", "twitter.com"].includes(host) && /\/status\/\d+/.test(x.pathname)) return url;
  if (["facebook.com", "fb.watch"].includes(host) && (/\/videos\//.test(x.pathname) || /^\/watch/.test(x.pathname) || host === "fb.watch")) return url;
  return "";
}

// Ticket affiliate link: either a plain https link, or a template with {url} where the
// StubHub event page goes (e.g. an affiliate network's ".../destination:{url}" link).
function cleanTicketLink(v) {
  const t = str(v, 500);
  if (!t) return "";
  const test = cleanUrl(t.split("{url}").join("https%3A%2F%2Fwww.stubhub.com%2F"));
  return test.startsWith("https://") ? t : "";
}

// Validate and normalise whatever the editor sends, so bad input can't break the page.
export function sanitizeSite(input) {
  if (!input || typeof input !== "object") throw new Error("Body must be a JSON object");
  const stories = Array.isArray(input.stories) ? input.stories : [];
  if (stories.length > 300) throw new Error("Too many stories (max 300)");
  const seen = new Set();
  const out = [];
  for (const s of stories) {
    if (!s || typeof s !== "object") continue;
    const url = cleanUrl(s.url);
    const headline = str(s.headline, 300);
    if (!url || !headline) continue;
    let id = str(s.id, 40).replace(/[^a-zA-Z0-9_-]/g, "");
    if (!id || seen.has(id)) id = "s" + Math.random().toString(36).slice(2, 10);
    seen.add(id);
    out.push({
      id, headline, url,
      source: str(s.source, 80),
      slot: SLOTS.includes(s.slot) ? s.slot : "left",
      hot: !!s.hot,
      red: !!s.red,
      order: Number.isFinite(s.order) ? s.order : 0,
      matchup: cleanMatchup(s.matchup),
      embed: cleanEmbed(s.embed),
      image: cleanImage(s.image),
      imageCredit: str(s.imageCredit, 80)
    });
  }
  const shopLinks = (input.shop && Array.isArray(input.shop.links) ? input.shop.links : [])
    .slice(0, 20)
    .map(l => ({ label: str(l && l.label, 80), url: cleanUrl(l && l.url) }))
    .filter(l => l.label && l.url);
  return {
    ticker: str(input.ticker, 200),
    tickerManual: !!input.tickerManual,
    sponsor: { on: !!(input.sponsor && input.sponsor.on), name: str(input.sponsor && input.sponsor.name, 80), url: cleanUrl(input.sponsor && input.sponsor.url) },
    shop: { on: !!(input.shop && input.shop.on), title: str(input.shop && input.shop.title, 60) || "SHOP THE HORNS", links: shopLinks },
    tickets: { on: !!(input.tickets && input.tickets.on), link: cleanTicketLink(input.tickets && input.tickets.link) },
    newsletter: { on: !!(input.newsletter && input.newsletter.on), url: cleanUrl(input.newsletter && input.newsletter.url), pitch: str(input.newsletter && input.newsletter.pitch, 160) },
    podcast: { on: !!(input.podcast && input.podcast.on), title: str(input.podcast && input.podcast.title, 160), url: cleanUrl(input.podcast && input.podcast.url) },
    stories: out,
    keepUrls: (Array.isArray(input.keepUrls) ? input.keepUrls : []).filter(x => typeof x === "string").map(x => x.slice(0, 2000)).slice(-300),
    hiddenAuto: (Array.isArray(input.hiddenAuto) ? input.hiddenAuto : []).filter(x => typeof x === "string").map(x => x.slice(0, 60)).slice(-500),
    updatedAt: new Date().toISOString()
  };
}
