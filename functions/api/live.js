// GET /api/live — Texas games on ESPN with live status and score, for ESPN Gamecast links:
// from the morning of game day (Central time) until 24 hours after the game ends, the link
// sits in the headline row at the very top ("top"): "GAMECAST" with the start time before,
// "LIVE" with the score during, "FINAL" with the score after. Then it drops to the sport's
// column (football left, everything else right) for 2 more days, and goes away.
// ESPN doesn't give an end time, so the end is estimated as start + a typical game length.
// Uses ESPN's public site API (no key). Texas is team 251 on ESPN.
import { json } from "../_lib.js";

const TEAM = "251";
// ESPN API path, ESPN web path, column, label, typical game length (hours)
const SPORTS = [
  ["football/college-football", "college-football", "left", "Football", 3.5],
  ["basketball/mens-college-basketball", "mens-college-basketball", "right", "Texas hoops", 2],
  ["basketball/womens-college-basketball", "womens-college-basketball", "right", "Women's hoops", 2],
  ["baseball/college-baseball", "college-baseball", "right", "Baseball", 3],
  ["baseball/college-softball", "college-softball", "right", "Softball", 2.5],
  ["volleyball/womens-college-volleyball", "womens-college-volleyball", "right", "Volleyball", 2]
];
const H = 3600000;
const TOP_HOURS = 24;    // hours after the (estimated) end that the link stays in the top row
const COLUMN_HOURS = 48; // then this many hours in the sport's column
const API = "https://site.api.espn.com/apis/site/v2/sports/";

function centralDay(d) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

async function getJson(url, ttl) {
  try {
    const r = await fetch(url, { cf: { cacheTtl: ttl, cacheEverything: true }, headers: { "user-agent": "Mozilla/5.0 (longhornsdaily.com)" } });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

const score = (c) => {
  const s = c && c.score;
  if (s == null) return "";
  return typeof s === "object" ? String(s.displayValue ?? s.value ?? "") : String(s);
};

function side(c) {
  const t = (c && c.team) || {};
  const rank = c && c.curatedRank && c.curatedRank.current;
  return {
    ou: String(t.id) === TEAM,
    name: t.shortDisplayName || t.location || t.displayName || "",
    abbr: t.abbreviation || "",
    rank: rank && rank < 26 ? rank : null,
    score: score(c),
    home: c && c.homeAway === "home",
    winner: !!(c && c.winner)
  };
}

export async function onRequestGet() {
  const now = new Date();
  const today = centralDay(now);

  const lists = await Promise.all(SPORTS.map(([api]) => getJson(`${API}${api}/teams/${TEAM}/schedule`, 600)));
  const picks = [];
  lists.forEach((data, i) => {
    const events = (data && Array.isArray(data.events)) ? data.events : [];
    events.forEach(ev => {
      if (!ev || !ev.id || !ev.date) return;
      const start = Date.parse(ev.date);
      const end = start + SPORTS[i][4] * H;
      const t = now.getTime();
      if (start > t && centralDay(new Date(start)) !== today) return; // future games: only on game day
      if (t > end + (TOP_HOURS + COLUMN_HOURS) * H) return;            // long over
      picks.push({ sport: SPORTS[i], ev, slot: t > end + TOP_HOURS * H ? SPORTS[i][2] : "top" });
    });
  });

  const games = (await Promise.all(picks.map(async ({ sport, ev, slot }) => {
    const [api, web, , label] = sport;
    const sum = await getJson(`${API}${api}/summary?event=${ev.id}`, slot === "top" ? 30 : 3600);
    const comp = (sum && sum.header && sum.header.competitions && sum.header.competitions[0]) || (ev.competitions && ev.competitions[0]) || {};
    const type = (comp.status && comp.status.type) || {};
    const sides = (comp.competitors || []).map(side);
    const ou = sides.find(s => s.ou), opp = sides.find(s => !s.ou);
    if (!ou || !opp) return null;
    return {
      id: ev.id,
      slot, label,
      url: `https://www.espn.com/${web}/game/_/gameId/${ev.id}`,
      start: ev.date,
      state: type.state || "pre",          // pre | in | post
      completed: !!type.completed,
      detail: type.shortDetail || type.detail || "",
      neutral: !!comp.neutralSite,
      ou, opp
    };
  }))).filter(Boolean).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));

  const anyLive = games.some(g => g.state === "in");
  return json({ updatedAt: now.toISOString(), games }, 200, { "cache-control": `public, max-age=${anyLive ? 30 : 120}` });
}
