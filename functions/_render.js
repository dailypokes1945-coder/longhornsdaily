// Server-side render of the front page, so search engines and link previews see the
// headlines in the HTML itself. app.js still loads in the browser and keeps the page
// live (it re-renders the same boxes every 2 minutes), so this only has to produce
// a faithful first paint. Mirrors the merge + render logic in public/app.js.

const COLS = ["left", "center", "right"];

export function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function safeUrl(u) {
  try { const x = new URL(u); return (x.protocol === "http:" || x.protocol === "https:") ? x.href : null; }
  catch { return null; }
}
function safeImg(u) {
  if (typeof u !== "string") return null;
  if (/^\/(img|photos)\/[a-zA-Z0-9._-]+$/.test(u)) return u;
  const h = safeUrl(u); return h && h.startsWith("https://") ? h : null;
}
function aOpen(url, cls) {
  const href = safeUrl(url);
  return "<a" + (href ? ` href="${esc(href)}"` : "") + ` target="_blank" rel="noopener"` + (cls ? ` class="${cls}"` : "") + ">";
}

// Same rules as the browser: expired column stories drop out (unless kept),
// morning-update stories go above the owner's (newest first), and the automatic ticker wins
// unless the owner chose their own.
const EXPIRABLE = ["left", "center", "right", "top", "banner"];

export function mergeSite(site, auto, overrides) {
  site = { ...(site || {}) };
  let stories = Array.isArray(site.stories) ? site.stories : [];
  stories = addOverrides(stories, overrides);
  site.stories = stories;
  if (!auto || typeof auto !== "object") return { ...site, stories };
  const hidden = new Set(site.hiddenAuto || []);
  const keep = new Set(site.keepUrls || []);
  const expired = new Set((Array.isArray(auto.expired) ? auto.expired : []).map(x => typeof x === "string" ? x : x && x.url).filter(Boolean));
  // Morning-update banner: an auto story with slot "banner" takes over the banner, and the owner's
  // banner drops into the column named in "dropTo" (below the new automatic stories there).
  // Hiding it (or editing it into one of the owner's stories) in the editor turns this off.
  const urls0 = new Set(stories.map(s => s && s.url));
  const banner = (Array.isArray(auto.stories) ? auto.stories : [])
    .find(a => a && a.slot === "banner" && a.url && a.headline && !hidden.has(a.id) && !urls0.has(a.url));
  if (banner) {
    const drop = COLS.includes(banner.dropTo) ? banner.dropTo : "center";
    stories = stories.map((s, i) => s && s.slot === "banner" ? { ...s, slot: drop, order: -500 + i } : s);
  }
  // Expired stories (games that are over) drop out of the columns, the top links and the banner, unless kept.
  const own = stories.filter(s => !(EXPIRABLE.includes(s.slot) && expired.has(s.url) && !keep.has(s.url)));
  const have = new Set(own.map(s => s.url));
  const extra = (Array.isArray(auto.stories) ? auto.stories : [])
    .filter(a => a && (COLS.includes(a.slot) || a.slot === "top") && !hidden.has(a.id) && !have.has(a.url) && !expired.has(a.url))
    .map((a, i) => ({ ...a, hot: false, order: (a.pin ? -2000 : -1000) + i }));
  site.stories = own.concat(extra, banner ? [{ ...banner, hot: false, order: -1000 }] : []);
  if (typeof auto.ticker === "string" && auto.ticker.trim() && !site.tickerManual) site.ticker = auto.ticker.trim();
  return site;
}

// Extra stories Claude adds for the owner from public/overrides.json (any slot, own order).
// Remove them by deleting them from that file.
// "moves" changes the slot/order of an existing story (matched by url), starting at "from",
// and can also swap its image, imageCredit or embed ("" clears it).
export function addOverrides(stories, overrides, now = Date.now()) {
  const moves = overrides && Array.isArray(overrides.moves) ? overrides.moves : [];
  const live = moves.filter(m => m && m.url && (!m.from || Date.parse(m.from) <= now));
  if (live.length) stories = stories.map(s => {
    const m = s && live.find(x => x.url === s.url);
    return m ? { ...s, ...(m.slot ? { slot: m.slot } : {}), ...(typeof m.order === "number" ? { order: m.order } : {}),
      ...(typeof m.image === "string" ? { image: m.image } : {}), ...(typeof m.imageCredit === "string" ? { imageCredit: m.imageCredit } : {}),
      ...(typeof m.embed === "string" ? { embed: m.embed } : {}) } : s;
  });
  const extra = overrides && Array.isArray(overrides.stories) ? overrides.stories : [];
  const have = new Set(stories.map(s => s && s.url));
  return stories.concat(extra.filter(o => o && o.slot && o.url && o.headline && !have.has(o.url)));
}

function headlineHTML(text) {
  // Words in [square brackets] and the word LIVE show in red
  return String(text || "").toUpperCase().split(/(\[[^\]]+\]|\bLIVE\b)/).map(part => {
    if (!part) return "";
    if (part === "LIVE" || (part.startsWith("[") && part.endsWith("]"))) return `<span class="live">${esc(part.replace(/^\[|\]$/g, ""))}</span>`;
    return esc(part);
  }).join("");
}

function matchupHTML(m, url) {
  const side = (rank, team, home) =>
    `<div class="side${home ? " home" : ""}">` + (rank ? `<span class="rank">${esc(rank)}</span>` : "") + `<span class="team">${esc(team)}</span></div>`;
  return aOpen(url, "matchup") + side(m.leftRank, m.left, true) + `<div class="vs">VS</div>` + side(m.rightRank, m.right, false) +
    (m.when ? `<div class="when">${esc(m.when)}</div>` : "") + "</a>";
}

export function storyHTML(s) {
  let h = `<div class="item${(s.matchup || s.image) ? " big" : ""}">`;
  const img = s.image && safeImg(s.image);
  if (img) {
    h += `<figure class="photo">${aOpen(s.url)}<img src="${esc(img)}" alt="${esc(s.headline)}" loading="lazy" decoding="async"></a>` +
      (s.imageCredit ? `<figcaption>${esc(s.imageCredit)}</figcaption>` : "") + "</figure>";
  }
  if (s.matchup && s.matchup.left && s.matchup.right) h += matchupHTML(s.matchup, s.url);
  if (s.embed && !/facebook\.com|fb\.watch/.test(s.embed)) {
    const e = safeUrl(s.embed);
    if (e) h += `<div class="embed"><blockquote class="twitter-tweet" data-dnt="true"><a href="${esc(e.replace("://x.com/", "://twitter.com/"))}">View the post on X</a></blockquote></div>`;
  }
  h += aOpen(s.url, s.red ? "red" : (s.hot ? "hot" : "")) + headlineHTML(s.headline) + "</a>";
  if (s.source) h += `<span class="src">— ${esc(s.source)}</span>`;
  return h + "</div>";
}

function centralKey(now) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", month: "2-digit", day: "2-digit" }).formatToParts(now);
  return parts.find(p => p.type === "month").value + "-" + parts.find(p => p.type === "day").value;
}

function otdHTML(history, now) {
  if (!history || typeof history !== "object") return "";
  const items = (history[centralKey(now)] || []).slice()
    .sort((a, b) => (b.top ? 1 : 0) - (a.top ? 1 : 0) || b.year - a.year).slice(0, 2);
  if (!items.length) return "";
  return `<h4>ON THIS DAY IN LONGHORN HISTORY</h4><ul>` +
    items.map(it => `<li><span class="yr">${esc(it.year)}</span>${aOpen(it.url)}${esc(it.text)}</a></li>`).join("") + "</ul>";
}

// Swap one exact snippet of the page template; if the template changed and the
// snippet is gone, leave the page as it is (the browser still fills it in).
function swap(html, from, to) { return html.includes(from) ? html.replace(from, () => to) : html; }

export function renderPage(template, site, auto, history, now = new Date(), overrides = null) {
  const s = mergeSite(site, auto, overrides);
  const stories = Array.isArray(s.stories) ? s.stories : [];
  const bySlot = (slot) => stories.filter(x => x && x.slot === slot && x.url && x.headline)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  let html = template;

  const cols = ["", "", ""];
  bySlot("top").forEach((x, i) => { cols[i % 3] += storyHTML(x); });
  html = swap(html, `<div class="top" id="slot-top"></div>`, `<div class="top" id="slot-top">${cols.map(c => `<div>${c}</div>`).join("")}</div>`);
  html = swap(html, `<div class="banner" id="slot-banner"></div>`, `<div class="banner" id="slot-banner">${bySlot("banner").map(storyHTML).join("")}</div>`);
  html = swap(html, `<div class="feature" id="slot-feature"></div>`, `<div class="feature" id="slot-feature">${bySlot("feature").map(storyHTML).join("")}</div>`);
  for (const slot of COLS) html = swap(html, `<div id="slot-${slot}"></div>`, `<div id="slot-${slot}">${bySlot(slot).map(storyHTML).join("")}</div>`);

  if (s.ticker) html = swap(html, `<div class="ticker" id="ticker" hidden></div>`, `<div class="ticker" id="ticker">${esc(s.ticker)}</div>`);
  if (s.sponsor && s.sponsor.on && s.sponsor.name) {
    const name = esc(String(s.sponsor.name).toUpperCase());
    const url = safeUrl(s.sponsor.url);
    html = swap(html, `<div class="sponsor" id="sponsor" hidden></div>`,
      `<div class="sponsor" id="sponsor">PRESENTED BY ${url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${name}</a>` : name}</div>`);
  }
  const otd = otdHTML(history, now);
  if (otd) html = swap(html, `<div class="box otd" id="otd" hidden></div>`, `<div class="box otd" id="otd">${otd}</div>`);

  if (stories.length) html = swap(html, `<div class="status" id="status">Loading headlines…</div>`, `<div class="status" id="status"></div>`);
  return html;
}
