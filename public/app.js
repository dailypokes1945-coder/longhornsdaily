(function () {
  const $ = (id) => document.getElementById(id);

  function dateline() {
    $("dateline").textContent = new Date().toLocaleString("en-US", {
      weekday: "short", month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit", timeZone: "America/Chicago"
    }).toUpperCase() + " CT";
  }
  dateline(); setInterval(dateline, 30000);

  // Special looks: the page turns burnt orange on Texas football gamedays, gets turkeys on Thanksgiving and Santa on Christmas Eve/Day.
  // Add each football game date (Central time, "YYYY-MM-DD") to GAMEDAYS. Preview with ?theme=gameday, ?theme=thanksgiving or ?theme=christmas.
  const GAMEDAYS = []; // All-orange gameday look is off. Add football game dates here ("YYYY-MM-DD") to turn it on.
  function applyTheme() {
    const p = {};
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" })
      .formatToParts(new Date()).forEach(x => { p[x.type] = x.value; });
    const ymd = p.year + "-" + p.month + "-" + p.day;
    const isThanksgiving = p.month === "11" && p.weekday === "Thu" && +p.day >= 22 && +p.day <= 28; // 4th Thursday of November
    const isChristmas = p.month === "12" && (p.day === "24" || p.day === "25"); // Christmas Eve and Christmas Day
    let theme = GAMEDAYS.includes(ymd) ? "gameday" : isThanksgiving ? "thanksgiving" : isChristmas ? "christmas" : "";
    const forced = new URLSearchParams(location.search).get("theme");
    if (["gameday", "thanksgiving", "christmas"].includes(forced)) theme = forced;
    if (!theme) return;
    document.body.classList.add(theme);
    const tag = document.querySelector(".tag");
    if (tag) tag.textContent = { gameday: "★ IT'S GAMEDAY · LET'S GO HORNS ★", thanksgiving: "🦃 HAPPY THANKSGIVING, HORNS FANS 🦃", christmas: "🎅 MERRY CHRISTMAS, HORNS FANS 🎄" }[theme];
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta && theme === "gameday") meta.content = "#BF5700";
  }
  applyTheme();

  function safeUrl(u) {
    try { const x = new URL(u); return (x.protocol === "http:" || x.protocol === "https:") ? x.href : null; }
    catch { return null; }
  }
  function link(url, text, cls) {
    const a = document.createElement("a");
    const href = safeUrl(url); if (href) a.href = href;
    a.target = "_blank"; a.rel = "noopener";
    a.textContent = text;
    if (cls) a.className = cls;
    return a;
  }
  // The owner's affiliate link, with the game's StubHub page put where {url} is.
  // Only StubHub pages from the morning update are used.
  function ticketUrl(template, eventUrl) {
    const ev = safeUrl(eventUrl);
    if (!ev || !/^https:\/\/(www\.)?stubhub\.com\//.test(ev)) return null;
    const out = template.includes("{url}") ? template.split("{url}").join(encodeURIComponent(ev)) : template;
    const href = safeUrl(out);
    return href && href.startsWith("https://") ? href : null;
  }
  let widgetsLoaded = false;
  function loadWidgets() {
    if (window.twttr && window.twttr.widgets) { window.twttr.widgets.load(); return; }
    if (widgetsLoaded) return;
    widgetsLoaded = true;
    const sc = document.createElement("script");
    sc.src = "https://platform.twitter.com/widgets.js"; sc.async = true; sc.charset = "utf-8";
    document.body.appendChild(sc);
  }
  let fbLoading = false;
  function loadFacebook(el) {
    if (window.FB && window.FB.XFBML) { setTimeout(() => window.FB.XFBML.parse(el.parentNode || el), 0); return; }
    if (fbLoading) return;
    fbLoading = true;
    const root = document.createElement("div"); root.id = "fb-root"; document.body.prepend(root);
    const sc = document.createElement("script");
    sc.async = true; sc.defer = true; sc.crossOrigin = "anonymous";
    sc.src = "https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v21.0";
    document.body.appendChild(sc);
  }
  function matchupEl(m, url) {
    const a = link(url, "");
    a.className = "matchup";
    const side = (rank, team, home) => {
      const d = document.createElement("div"); d.className = "side" + (home ? " home" : "");
      if (rank) { const r = document.createElement("span"); r.className = "rank"; r.textContent = rank; d.appendChild(r); }
      const t = document.createElement("span"); t.className = "team"; t.textContent = team; d.appendChild(t);
      return d;
    };
    const vs = document.createElement("div"); vs.className = "vs"; vs.textContent = "VS";
    a.append(side(m.leftRank, m.left, true), vs, side(m.rightRank, m.right, false));
    if (m.when) { const w = document.createElement("div"); w.className = "when"; w.textContent = m.when; a.appendChild(w); }
    return a;
  }
  function embedEl(url) {
    const wrap = document.createElement("div"); wrap.className = "embed";
    if (/facebook\.com|fb\.watch/.test(url)) {
      // Facebook's own embed: with data-autoplay it starts playing (muted) once it's on screen.
      const d = document.createElement("div");
      d.className = "fb-video";
      d.setAttribute("data-href", url);
      d.setAttribute("data-width", "560");
      d.setAttribute("data-autoplay", "true");
      d.setAttribute("data-show-text", "false");
      d.setAttribute("data-allowfullscreen", "true");
      wrap.appendChild(d);
      loadFacebook(wrap);
      return wrap;
    }
    const bq = document.createElement("blockquote"); bq.className = "twitter-tweet"; bq.setAttribute("data-dnt", "true");
    const a = document.createElement("a"); a.href = url.replace("://x.com/", "://twitter.com/"); a.textContent = "View the post on X";
    bq.appendChild(a); wrap.appendChild(bq);
    return wrap;
  }
  function storyEl(s) {
    const div = document.createElement("div");
    div.className = "item" + ((s.matchup || s.image) ? " big" : "");
    if (s.image) {
      const fig = document.createElement("figure"); fig.className = "photo";
      const a = link(s.url, "");
      const img = document.createElement("img");
      img.src = s.image; img.alt = s.headline || ""; img.loading = "lazy"; img.decoding = "async";
      a.appendChild(img); fig.appendChild(a);
      if (s.imageCredit) { const c = document.createElement("figcaption"); c.textContent = s.imageCredit; fig.appendChild(c); }
      div.appendChild(fig);
    }
    if (s.matchup) div.appendChild(matchupEl(s.matchup, s.url));
    if (s.embed) div.appendChild(embedEl(s.embed));
    const text = String(s.headline || "").toUpperCase();
    const a = link(s.url, "", s.red ? "red" : (s.hot ? "hot" : ""));
    // Words in [square brackets] and the word LIVE show in red
    text.split(/(\[[^\]]+\]|\bLIVE\b)/).forEach(part => {
      if (!part) return;
      if (part === "LIVE" || (part.startsWith("[") && part.endsWith("]"))) {
        const l = document.createElement("span"); l.className = "live";
        l.textContent = part.replace(/^\[|\]$/g, ""); a.appendChild(l);
      } else a.appendChild(document.createTextNode(part));
    });
    div.appendChild(a);
    if (s.source) {
      const src = document.createElement("span");
      src.className = "src"; src.textContent = "— " + s.source;
      div.appendChild(src);
    }
    return div;
  }

  function render(site) {
    const stories = Array.isArray(site.stories) ? site.stories : [];
    const bySlot = (slot) => stories.filter(s => s.slot === slot).sort((a, b) => (a.order || 0) - (b.order || 0));

    const top = $("slot-top"); top.textContent = "";
    const cols = [0, 1, 2].map(() => document.createElement("div"));
    bySlot("top").forEach((s, i) => cols[i % 3].appendChild(storyEl(s)));
    cols.forEach(c => top.appendChild(c));

    let hasEmbed = false;
    ["banner", "feature", "left", "center", "right"].forEach(slot => {
      const box = $("slot-" + slot);
      const list = bySlot(slot);
      const sig = JSON.stringify(list);
      if (box.dataset.sig === sig) { if (list.some(s => s.embed && !/facebook\.com|fb\.watch/.test(s.embed))) hasEmbed = true; return; } // don't re-render embeds needlessly
      box.dataset.sig = sig; box.textContent = "";
      list.forEach(s => { box.appendChild(storyEl(s)); if (s.embed && !/facebook\.com|fb\.watch/.test(s.embed)) hasEmbed = true; });
    });
    if (hasEmbed) loadWidgets();

    // Ticker: plain text, or (with ticket links on) one ticket link after each game that has one
    const t = $("ticker"); t.textContent = "";
    let ticketsShown = false;
    const tix = site.tickets || {};
    const items = Array.isArray(site.tickerItems) ? site.tickerItems.filter(x => x && typeof x.text === "string" && x.text.trim()) : [];
    if (tix.on && tix.link && items.length) {
      items.forEach((it, i) => {
        if (i) t.append(" ★ ");
        t.append(it.text.trim());
        const href = ticketUrl(tix.link, it.tickets);
        if (href) {
          t.append(" — ");
          const a = link(href, "🎟 TICKETS*", "tix"); a.rel = "noopener sponsored";
          t.appendChild(a); ticketsShown = true;
        }
      });
    } else t.textContent = site.ticker || "";
    t.hidden = !t.textContent;

    const sp = $("sponsor"); sp.textContent = "";
    if (site.sponsor && site.sponsor.on && site.sponsor.name) {
      sp.append("PRESENTED BY ");
      sp.appendChild(site.sponsor.url ? link(site.sponsor.url, site.sponsor.name.toUpperCase()) : document.createTextNode(site.sponsor.name.toUpperCase()));
      sp.hidden = false;
    } else sp.hidden = true;

    const pod = $("podcast"); pod.textContent = "";
    if (site.podcast && site.podcast.on && site.podcast.url) {
      const h = document.createElement("h4"); h.textContent = "🎙 THE LONGHORNS DAILY PODCAST"; pod.appendChild(h);
      if (site.podcast.title) { const p = document.createElement("p"); p.textContent = "Latest: " + site.podcast.title; pod.appendChild(p); }
      pod.appendChild(link(site.podcast.url, "LISTEN NOW", "btn"));
      pod.hidden = false;
    } else pod.hidden = true;

    const nl = $("newsletter"); nl.textContent = "";
    if (site.newsletter && site.newsletter.on && site.newsletter.url) {
      const h = document.createElement("h4"); h.textContent = "✉ THE DAILY RUNDOWN"; nl.appendChild(h);
      const p = document.createElement("p"); p.textContent = site.newsletter.pitch || "Get Longhorns Daily in your inbox."; nl.appendChild(p);
      nl.appendChild(link(site.newsletter.url, "SIGN UP FREE", "btn"));
      nl.hidden = false;
    } else nl.hidden = true;

    const shop = $("shop"); shop.textContent = "";
    const links = site.shop && Array.isArray(site.shop.links) ? site.shop.links : [];
    const shopOn = !!(site.shop && site.shop.on && links.length);
    if (shopOn) {
      const h = document.createElement("h4"); h.textContent = site.shop.title || "SHOP THE HORNS"; shop.appendChild(h);
      const ul = document.createElement("ul");
      links.forEach(l => { const li = document.createElement("li"); const a = link(l.url, l.label); a.rel = "noopener sponsored"; li.appendChild(a); ul.appendChild(li); });
      shop.appendChild(ul);
    }
    shop.hidden = !shopOn;
    $("disclosure").hidden = !(shopOn || ticketsShown);

    if (site.updatedAt) {
      $("updated").textContent = "UPDATED " + new Date(site.updatedAt).toLocaleString("en-US", {
        month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago"
      }).toUpperCase();
    }
  }

  let liveNow = false;
  function gameHeadline(g) {
    const opp = (g.opp.rank ? "No. " + g.opp.rank + " " : "") + g.opp.name;
    const ou = (g.ou.rank ? "No. " + g.ou.rank + " " : "") + "Texas";
    const where = g.ou.home || g.neutral ? "vs." : "at";
    if (g.state === "in") return `LIVE · ${g.label}: ${ou} ${g.ou.score}, ${opp} ${g.opp.score} (${g.detail}) — Gamecast`;
    if (g.state === "post" && g.completed) {
      const ouWon = g.ou.winner || (!g.opp.winner && +g.ou.score > +g.opp.score);
      const line = ouWon ? `${ou} ${g.ou.score}, ${opp} ${g.opp.score}` : `${opp} ${g.opp.score}, ${ou} ${g.ou.score}`;
      return `Final · ${g.label}: ${line} — Gamecast`;
    }
    if (g.state === "post") return `${g.detail || "Postponed"} · ${g.label} ${where} ${opp}`;
    const tbd = /TBD|TBA/i.test(g.detail || "");
    const t = tbd ? "" : ", " + new Date(g.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }).replace(":00", "") + " CT";
    return `Gamecast · ${g.label} ${where} ${opp}${t}`;
  }

  async function load(first) {
    try {
      const [res, autoRes, ovRes, liveRes] = await Promise.all([
        fetch("/api/site", { cache: "no-cache" }),
        fetch("/auto.json", { cache: "no-cache" }).catch(() => null),
        fetch("/overrides.json", { cache: "no-cache" }).catch(() => null),
        fetch("/api/live").catch(() => null)
      ]);
      if (!res.ok) throw new Error(res.status);
      const site = await res.json();
      // Extra stories from /overrides.json (any slot, own order) — same rule as functions/_render.js
      try {
        const ov = ovRes && ovRes.ok ? await ovRes.json() : null;
        const moves = (ov && Array.isArray(ov.moves) ? ov.moves : []).filter(m => m && m.url && (!m.from || Date.parse(m.from) <= Date.now()));
        site.stories = (site.stories || []).map(s => {
          const m = moves.find(x => x.url === s.url);
          return m ? { ...s, ...(m.slot ? { slot: m.slot } : {}), ...(typeof m.order === "number" ? { order: m.order } : {}),
      ...(typeof m.image === "string" ? { image: m.image } : {}), ...(typeof m.imageCredit === "string" ? { imageCredit: m.imageCredit } : {}),
      ...(typeof m.embed === "string" ? { embed: m.embed } : {}) } : s;
        });
        const extra = ov && Array.isArray(ov.stories) ? ov.stories : [];
        const have0 = new Set((site.stories || []).map(s => s.url));
        site.stories = (site.stories || []).concat(extra.filter(o => o && o.slot && o.url && o.headline && !have0.has(o.url)));
      } catch (e) { /* overrides are optional */ }
      // Morning-update stories go at the top of each column (newest first), above the owner's own stories
      try {
        const auto = autoRes && autoRes.ok ? await autoRes.json() : null;
        const hidden = new Set(site.hiddenAuto || []);
        // Stories about games that are over: the morning update lists them, and they drop out of the
        // three columns (never the banner, feature or top links) unless the owner chose to keep them.
        const keep = new Set(site.keepUrls || []);
        const expired = new Set((auto && Array.isArray(auto.expired) ? auto.expired : []).map(x => typeof x === "string" ? x : x && x.url).filter(Boolean));
        site.stories = (site.stories || []).filter(s => !(["left", "center", "right"].includes(s.slot) && expired.has(s.url) && !keep.has(s.url)));
        const have = new Set((site.stories || []).map(s => s.url));
        const extra = (auto && Array.isArray(auto.stories) ? auto.stories : [])
          .filter(a => ["left", "center", "right"].includes(a.slot) && !hidden.has(a.id) && !have.has(a.url))
          .map((a, i) => ({ ...a, hot: false, order: (a.pin ? -2000 : -1000) + i })); // "pin": true puts it at the top of its column
        site.stories = (site.stories || []).concat(extra);
        // The morning update keeps the ticker current unless the owner chose their own
        if (auto && typeof auto.ticker === "string" && auto.ticker.trim() && !site.tickerManual) {
          site.ticker = auto.ticker.trim();
          if (Array.isArray(auto.tickerItems)) site.tickerItems = auto.tickerItems;
        }
      } catch (e) { /* auto stories are optional */ }
      // Texas games on ESPN (/api/live): a Gamecast link first in the top headline row from game day until
      // 24 hours after the game ends (start time, then LIVE + score, then FINAL + score),
      // then first in the sport's column for 2 more days.
      try {
        const live = liveRes && liveRes.ok ? await liveRes.json() : null;
        const games = live && Array.isArray(live.games) ? live.games : [];
        const hiddenLive = new Set(site.hiddenAuto || []);
        liveNow = games.some(g => g.state === "in");
        const gs = games.filter(g => g && g.url && g.ou && g.opp && !hiddenLive.has("live-" + g.id))
          .map((g, i) => ({ id: "live-" + g.id, slot: g.slot, headline: gameHeadline(g), url: g.url, source: "ESPN Gamecast",
            red: g.state === "in", hot: false, order: -3000 + i }));
        site.stories = gs.concat(site.stories || []);
      } catch (e) { /* live games are optional */ }
      render(site);
      $("status").textContent = "";
    } catch (e) {
      if (first) $("status").textContent = "Couldn't load headlines — try refreshing.";
    }
  }
  // On This Day in Longhorn history (from /history.json, keyed by MM-DD in Central time)
  async function loadHistory() {
    try {
      const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
      const key = parts.find(p => p.type === "month").value + "-" + parts.find(p => p.type === "day").value;
      const res = await fetch("/history.json", { cache: "no-cache" });
      if (!res.ok) return;
      const all = await res.json();
      const items = (all[key] || []).slice().sort((a, b) => (b.top ? 1 : 0) - (a.top ? 1 : 0) || b.year - a.year).slice(0, 2);
      const box = $("otd"); box.textContent = "";
      if (!items.length) { box.hidden = true; return; }
      const h = document.createElement("h4"); h.textContent = "ON THIS DAY IN LONGHORN HISTORY"; box.appendChild(h);
      const ul = document.createElement("ul");
      items.forEach(it => {
        const li = document.createElement("li");
        const y = document.createElement("span"); y.className = "yr"; y.textContent = it.year;
        li.appendChild(y);
        li.appendChild(link(it.url, it.text));
        ul.appendChild(li);
      });
      box.appendChild(ul); box.hidden = false;
    } catch (e) { /* box stays hidden */ }
  }
  loadHistory();
  load(true);
  // Refresh every 2 minutes, or every minute while a Texas game is live
  let ticks = 0;
  setInterval(() => { ticks++; if (!document.hidden && (liveNow || ticks % 2 === 0)) load(false); }, 60000);
})();
