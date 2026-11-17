// Daily archive: one permanent page per day (longhornsdaily.com/archive/YYYY-MM-DD) with that
// day's headlines, so search engines have many lasting pages instead of one that changes.
//
// Snapshots are taken by the front page itself (functions/index.js): when it renders, it
// saves what visitors see under KV key "day:YYYY-MM-DD" (Central time), at most once an
// hour, so each day's page ends up as the last version of that day's front page.
// The morning update adds an original 2-3 sentence rundown per day in public/rundowns.json.
import { esc } from "./_render.js";

const SNAP_EVERY_MS = 60 * 60 * 1000;
const SLOT_ORDER = ["banner", "feature", "top", "left", "center", "right"];
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function centralDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function cleanStory(s) {
  try { const u = new URL(s.url); if (u.protocol !== "https:" && u.protocol !== "http:") return null; } catch { return null; }
  if (!s.headline) return null;
  return { slot: s.slot, headline: String(s.headline).slice(0, 300), url: s.url, source: String(s.source || "").slice(0, 80) };
}

// Save today's front page (already merged with the morning update) if the saved copy is
// missing or over an hour old. Never throws: the archive must not break the front page.
export async function maybeSnapshot(env, merged, now = new Date()) {
  try {
    if (!env.SITE || !merged) return;
    const date = centralDate(now);
    const key = "day:" + date;
    const { metadata } = await env.SITE.getWithMetadata(key);
    if (metadata && metadata.t && now.getTime() - metadata.t < SNAP_EVERY_MS) return;
    const stories = (Array.isArray(merged.stories) ? merged.stories : [])
      .filter(s => s && SLOT_ORDER.includes(s.slot))
      .sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot) || (a.order || 0) - (b.order || 0))
      .map(cleanStory).filter(Boolean);
    if (!stories.length) return;
    const snap = { date, savedAt: now.toISOString(), ticker: String(merged.ticker || "").slice(0, 300), stories };
    await env.SITE.put(key, JSON.stringify(snap), { metadata: { t: now.getTime(), n: stories.length } });
  } catch { /* ignore */ }
}

export async function listDays(env) {
  if (!env.SITE) return [];
  const days = []; let cursor;
  do {
    const r = await env.SITE.list({ prefix: "day:", cursor });
    for (const k of r.keys) { const d = k.name.slice(4); if (DATE_RE.test(d)) days.push(d); }
    cursor = r.list_complete ? null : r.cursor;
  } while (cursor);
  return days.sort().reverse();
}

export function longDate(date) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}
function shortDate(date) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function shell({ title, description, canonical, body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:site_name" content="Longhorns Daily">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="https://longhornsdaily.com/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#BF5700">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon-96.png" type="image/png" sizes="96x96">
<link rel="icon" href="/favicon-192.png" type="image/png" sizes="192x192">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="stylesheet" href="/style.css?v=26">
</head>
<body>
<div class="wrap archive">
  <a class="logo small" href="/">LONGHORNS <span>DAILY</span></a>
  <div class="tag">ALL HORNS · ALL THE TIME</div>
${body}
  <footer>
    Every headline links to its original source.<br>
    Longhorns Daily is an independent fan site and is not affiliated with the University of Texas at Austin.<br>
    <a href="/">TODAY'S HEADLINES</a> · <a href="/archive/">ARCHIVE</a> · <a href="/about">ABOUT</a> · <a href="/privacy">PRIVACY</a> · <a class="advertise" href="mailto:ads@longhornsdaily.com?subject=Advertising%20on%20Longhorns%20Daily">ADVERTISE WITH LONGHORNS DAILY</a>
  </footer>
</div>
</body>
</html>`;
}

const SECTIONS = [
  ["TOP STORIES", ["banner", "feature", "top"]],
  ["GRIDIRON", ["left"]],
  ["AROUND THE PROGRAM", ["center"]],
  ["HOOPS · NET · DIAMOND", ["right"]]
];

export function dayPage(snap, rundown, prev, next) {
  const date = snap.date;
  const title = `Texas sports headlines, ${shortDate(date)} | Longhorns Daily`;
  const description = rundown
    ? rundown.slice(0, 155)
    : `Texas Longhorns headlines from ${longDate(date)}: football, basketball, volleyball, baseball and more, each linked to its original source.`;
  const canonical = `https://longhornsdaily.com/archive/${date}`;
  const seen = new Set();
  let sections = "";
  for (const [label, slots] of SECTIONS) {
    const list = snap.stories.filter(s => slots.includes(s.slot) && !seen.has(s.url));
    list.forEach(s => seen.add(s.url));
    if (!list.length) continue;
    sections += `  <section class="day-sec"><h2>${label}</h2><ul>\n` + list.map(s =>
      `    <li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(String(s.headline).replace(/[\[\]]/g, "").toUpperCase())}</a>` +
      (s.source ? ` <span class="src">— ${esc(s.source)}</span>` : "") + `</li>`).join("\n") + `\n  </ul></section>\n`;
  }
  const nav = `  <nav class="day-nav">` +
    (prev ? `<a href="/archive/${prev}">← ${esc(shortDate(prev).toUpperCase())}</a>` : `<span></span>`) +
    `<a href="/archive/">ALL DAYS</a>` +
    (next ? `<a href="/archive/${next}">${esc(shortDate(next).toUpperCase())} →</a>` : `<a href="/">TODAY →</a>`) + `</nav>\n`;
  const ld = JSON.stringify({ "@context": "https://schema.org", "@type": "CollectionPage", name: title, url: canonical, datePublished: date,
    description, isPartOf: { "@type": "WebSite", name: "Longhorns Daily", url: "https://longhornsdaily.com/" } }).replace(/</g, "\\u003c");
  const body =
`  <h1 class="day-h1">TEXAS LONGHORNS HEADLINES · ${esc(longDate(date).toUpperCase())}</h1>
${rundown ? `  <p class="rundown"><b>THE RUNDOWN:</b> ${esc(rundown)}</p>\n` : ""}${snap.ticker ? `  <div class="ticker">${esc(snap.ticker)}</div>\n` : ""}${sections}${nav}  <script type="application/ld+json">${ld}</script>`;
  return shell({ title, description, canonical, body });
}

export function indexPage(days) {
  const byMonth = new Map();
  for (const d of days) { const m = d.slice(0, 7); if (!byMonth.has(m)) byMonth.set(m, []); byMonth.get(m).push(d); }
  let body = `  <h1 class="day-h1">THE LONGHORNS DAILY ARCHIVE</h1>\n  <p class="rundown">Every day's Texas Longhorns headlines, as they appeared on Longhorns Daily.</p>\n`;
  if (!days.length) body += `  <p class="rundown">The first day will appear here soon.</p>\n`;
  for (const [m, list] of byMonth) {
    const [y, mo] = m.split("-").map(Number);
    const label = new Date(Date.UTC(y, mo - 1, 15)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).toUpperCase();
    body += `  <section class="day-sec"><h2>${label}</h2><ul>\n` + list.map(d => `    <li><a href="/archive/${d}">${esc(longDate(d).toUpperCase())}</a></li>`).join("\n") + `\n  </ul></section>\n`;
  }
  return shell({ title: "Archive: every day's Longhorns headlines | Longhorns Daily", description: "Every day's Texas Longhorns headlines from Longhorns Daily, by date.",
    canonical: "https://longhornsdaily.com/archive/", body });
}

export function sitemapXml(days) {
  const urls = [`  <url><loc>https://longhornsdaily.com/</loc><changefreq>hourly</changefreq><priority>1.0</priority></url>`,
    `  <url><loc>https://longhornsdaily.com/archive/</loc><changefreq>daily</changefreq><priority>0.6</priority></url>`,
    `  <url><loc>https://longhornsdaily.com/about</loc><changefreq>monthly</changefreq><priority>0.3</priority></url>`,
    `  <url><loc>https://longhornsdaily.com/privacy</loc><changefreq>yearly</changefreq><priority>0.2</priority></url>`]
    .concat(days.map(d => `  <url><loc>https://longhornsdaily.com/archive/${d}</loc><lastmod>${d}</lastmod><priority>0.5</priority></url>`));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

export async function loadRundowns(env, origin) {
  try {
    const r = await env.ASSETS.fetch(new Request(origin + "/rundowns.json"));
    if (!r.ok) return {};
    const j = await r.json();
    return j && typeof j === "object" ? j : {};
  } catch { return {}; }
}
