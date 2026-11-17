(function () {
  const SLOTS = [["banner", "Banner (big headline)"], ["feature", "Feature (graphic / post)"], ["top", "Top links"], ["left", "Gridiron"], ["center", "Around the Program"], ["right", "Hoops · Mats · Diamond"]];
  const $ = (id) => document.getElementById(id);
  let site = null, dirty = false, saving = false, editingId = null, baseUpdatedAt = null;

  const setMsg = (t) => { $("msg").textContent = t; };
  function markDirty() { dirty = true; $("publish").disabled = false; setMsg("Unpublished changes"); }
  window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

  function safeUrl(u) {
    try { const x = new URL(u); return (x.protocol === "http:" || x.protocol === "https:") ? x.href : null; }
    catch { return null; }
  }
  function readExtras(pre) {
    const v = (id) => $(pre + "-" + id).value.trim();
    const m = { left: v("ml"), leftRank: v("mlr"), right: v("mr"), rightRank: v("mrr"), when: v("mw") };
    return { matchup: m.left && m.right ? m : null, embed: v("em"), image: v("im"), imageCredit: v("ic") };
  }
  function fillExtras(pre, s) {
    const m = s.matchup || {};
    $(pre + "-ml").value = m.left || ""; $(pre + "-mlr").value = m.leftRank || "";
    $(pre + "-mr").value = m.right || ""; $(pre + "-mrr").value = m.rightRank || "";
    $(pre + "-mw").value = m.when || ""; $(pre + "-em").value = s.embed || "";
    $(pre + "-im").value = s.image || ""; $(pre + "-ic").value = s.imageCredit || "";
  }
  // Shrink big phone photos in the browser, then upload them
  async function shrink(file) {
    if (file.type === "image/gif") return file;
    const img = await createImageBitmap(file).catch(() => null);
    if (!img) return file;
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return await new Promise(r => c.toBlob(b => r(b || file), "image/jpeg", 0.85));
  }
  function wireUpload(pre) {
    const input = $(pre + "-file"); if (!input) return;
    input.addEventListener("change", async () => {
      const file = input.files && input.files[0]; if (!file) return;
      const msg = $(pre + "-upmsg"); msg.textContent = "Uploading…";
      try {
        const blob = await shrink(file);
        const res = await fetch("/admin/api/upload", { method: "POST", headers: { "content-type": blob.type || "image/jpeg" }, body: blob, credentials: "same-origin" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || ("Error " + res.status));
        $(pre + "-im").value = data.url; msg.textContent = "✓ Photo attached";
        if (pre === "e") markDirty();
      } catch (e) { msg.textContent = "Upload failed: " + e.message; }
      input.value = "";
    });
  }
  const newId = () => "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const bySlot = (slot) => site.stories.filter(s => s.slot === slot).sort((a, b) => (a.order || 0) - (b.order || 0));
  const topOrder = (slot) => { const l = bySlot(slot); return l.length ? (l[0].order || 0) - 1 : 0; };

  function renumber(slot) { bySlot(slot).forEach((s, i) => { s.order = i; }); }

  function renderSlots() {
    const box = $("slots"); box.textContent = "";
    SLOTS.forEach(([slot, label]) => {
      const wrap = document.createElement("div"); wrap.className = "slot";
      const h = document.createElement("h3"); h.textContent = label; wrap.appendChild(h);
      const list = bySlot(slot);
      if (!list.length) { const e = document.createElement("div"); e.className = "empty"; e.textContent = "(empty)"; wrap.appendChild(e); }
      list.forEach((s, i) => {
        const row = document.createElement("div"); row.className = "row";
        const hd = document.createElement("div"); hd.className = "h";
        const a = document.createElement("a"); a.textContent = s.headline; a.href = safeUrl(s.url) || "#"; a.target = "_blank"; a.rel = "noopener";
        if (s.hot) a.className = "hot";
        if (s.red) a.className = "red";
        const sm = document.createElement("small"); sm.textContent = (s.image ? "[photo] " : "") + (s.matchup ? "[graphic] " : "") + (s.embed ? "[X post] " : "") + (s.source ? s.source + " · " : "") + s.url;
        hd.append(a, sm); row.appendChild(hd);
        const b = (txt, fn, cls) => { const x = document.createElement("button"); x.type = "button"; x.textContent = txt; if (cls) x.className = cls; x.addEventListener("click", fn); row.appendChild(x); return x; };
        if (i > 0) b("↑", () => { const o = list[i - 1]; [s.order, o.order] = [o.order, s.order]; if (s.order === o.order) s.order--; markDirty(); renderSlots(); });
        if (i < list.length - 1) b("↓", () => { const o = list[i + 1]; [s.order, o.order] = [o.order, s.order]; if (s.order === o.order) s.order++; markDirty(); renderSlots(); });
        const sel = document.createElement("select");
        SLOTS.forEach(([v, l]) => { const o = document.createElement("option"); o.value = v; o.textContent = "→ " + l; if (v === s.slot) o.selected = true; sel.appendChild(o); });
        sel.addEventListener("change", () => { s.order = topOrder(sel.value); s.slot = sel.value; markDirty(); renderSlots(); });
        row.appendChild(sel);
        b(s.hot ? "unhot" : "hot", () => { s.hot = !s.hot; if (s.hot) s.red = false; markDirty(); renderSlots(); });
        b(s.red ? "unred" : "red", () => { s.red = !s.red; if (s.red) s.hot = false; markDirty(); renderSlots(); });
        b("edit", () => openEdit(s));
        const del = b("✕", () => {
          if (del.dataset.armed) { site.stories = site.stories.filter(x => x !== s); renumber(slot); markDirty(); renderSlots(); }
          else { del.dataset.armed = "1"; del.textContent = "delete?"; setTimeout(() => { if (del.isConnected) { delete del.dataset.armed; del.textContent = "✕"; } }, 3000); }
        }, "del");
        wrap.appendChild(row);
      });
      box.appendChild(wrap);
    });
  }

  let autoStories = [], autoExpired = [];
  async function loadAuto() {
    try { const r = await fetch("/auto.json", { cache: "no-store" }); const d = await r.json(); autoStories = Array.isArray(d.stories) ? d.stories : []; autoExpired = (Array.isArray(d.expired) ? d.expired : []).map(x => typeof x === "string" ? { url: x } : x).filter(x => x && x.url); if ($("tk-auto")) $("tk-auto").textContent = d.ticker || "(none yet — your ticker below is shown)"; }
    catch { autoStories = []; autoExpired = []; }
    renderAuto();
  }
  function renderAuto() {
    const box = $("auto-list"); if (!box) return; box.textContent = "";
    site.hiddenAuto = site.hiddenAuto || [];
    if (!autoStories.length) { const e = document.createElement("div"); e.className = "empty"; e.textContent = "Nothing added yet."; box.appendChild(e); return; }
    const names = { left: "Gridiron", center: "Around the Program", right: "Hoops · Mats · Diamond" };
    autoStories.forEach(a => {
      const hidden = site.hiddenAuto.includes(a.id);
      const row = document.createElement("div"); row.className = "row"; if (hidden) row.style.opacity = ".45";
      const hd = document.createElement("div"); hd.className = "h";
      const l = document.createElement("a"); l.textContent = a.headline; l.href = safeUrl(a.url) || "#"; l.target = "_blank"; l.rel = "noopener";
      const sm = document.createElement("small"); sm.textContent = (names[a.slot] || a.slot) + " · " + (a.source || "") + (hidden ? " · HIDDEN" : "");
      hd.append(l, sm); row.appendChild(hd);
      const btn = document.createElement("button"); btn.type = "button"; btn.textContent = hidden ? "show" : "hide";
      btn.addEventListener("click", () => {
        site.hiddenAuto = hidden ? site.hiddenAuto.filter(x => x !== a.id) : site.hiddenAuto.concat(a.id);
        markDirty(); renderAuto();
      });
      row.appendChild(btn); box.appendChild(row);
    });
    renderExpired();
  }
  function renderExpired() {
    const box = $("expired-list"); if (!box) return; box.textContent = "";
    site.keepUrls = site.keepUrls || [];
    const cols = ["left", "center", "right"];
    const mine = autoExpired.map(x => ({ x, s: (site.stories || []).find(s => s.url === x.url && cols.includes(s.slot)) })).filter(o => o.s);
    if (!mine.length) { const e = document.createElement("div"); e.className = "empty"; e.textContent = "Nothing expired."; box.appendChild(e); return; }
    mine.forEach(({ x, s }) => {
      const kept = site.keepUrls.includes(s.url);
      const row = document.createElement("div"); row.className = "row"; if (!kept) row.style.opacity = ".45";
      const hd = document.createElement("div"); hd.className = "h";
      const l = document.createElement("a"); l.textContent = s.headline; l.href = safeUrl(s.url) || "#"; l.target = "_blank"; l.rel = "noopener";
      const sm = document.createElement("small"); sm.textContent = (kept ? "KEPT on the page" : "HIDDEN on the page") + (x.reason ? " · " + x.reason : "");
      hd.append(l, sm); row.appendChild(hd);
      const btn = document.createElement("button"); btn.type = "button"; btn.textContent = kept ? "hide" : "keep";
      btn.addEventListener("click", () => {
        site.keepUrls = kept ? site.keepUrls.filter(u => u !== s.url) : site.keepUrls.concat(s.url);
        markDirty(); renderExpired();
      });
      row.appendChild(btn); box.appendChild(row);
    });
  }

  function renderShopLinks() {
    const box = $("shop-links"); box.textContent = "";
    site.shop.links.forEach((l, i) => {
      const row = document.createElement("div"); row.className = "linkrow";
      const lab = document.createElement("input"); lab.type = "text"; lab.placeholder = "Label (e.g. Burnt orange tees)"; lab.value = l.label || "";
      const url = document.createElement("input"); url.type = "url"; url.placeholder = "https://"; url.value = l.url || "";
      const rm = document.createElement("button"); rm.type = "button"; rm.textContent = "✕";
      lab.addEventListener("input", () => { l.label = lab.value; markDirty(); });
      url.addEventListener("input", () => { l.url = url.value; markDirty(); });
      rm.addEventListener("click", () => { site.shop.links.splice(i, 1); markDirty(); renderShopLinks(); });
      row.append(lab, url, rm); box.appendChild(row);
    });
  }

  function bindField(id, get, set, prop = "value") {
    const el = $(id); el[prop] = get();
    el.addEventListener(prop === "checked" ? "change" : "input", () => { set(el[prop]); markDirty(); });
  }

  function build() {
    const main = $("main");
    main.textContent = "";
    main.appendChild($("tpl").content.cloneNode(true));
    const sel = $("a-slot");
    SLOTS.forEach(([v, l]) => { const o = document.createElement("option"); o.value = v; o.textContent = l; sel.appendChild(o); });
    sel.value = "left";

    $("add").addEventListener("submit", (e) => {
      e.preventDefault();
      const url = safeUrl($("a-url").value.trim());
      const headline = $("a-headline").value.trim();
      if (!url || !headline) { alertBox("Add a headline and a full link starting with https://"); return; }
      const slot = $("a-slot").value;
      site.stories.push({ id: newId(), headline, url, source: $("a-source").value.trim(), slot, hot: $("a-hot").checked && !$("a-red").checked, red: $("a-red").checked, order: topOrder(slot), ...readExtras("a") });
      $("a-headline").value = ""; $("a-url").value = ""; $("a-source").value = ""; $("a-hot").checked = false; $("a-red").checked = false; fillExtras("a", {});
      markDirty(); renderSlots();
    });

    bindField("ticker", () => site.ticker || "", v => site.ticker = v);
    bindField("tk-manual", () => !!site.tickerManual, v => site.tickerManual = v, "checked");
    bindField("tix-on", () => !!site.tickets.on, v => site.tickets.on = v, "checked");
    bindField("tix-link", () => site.tickets.link || "", v => site.tickets.link = v.trim());
    bindField("sp-on", () => !!site.sponsor.on, v => site.sponsor.on = v, "checked");
    bindField("sp-name", () => site.sponsor.name || "", v => site.sponsor.name = v);
    bindField("sp-url", () => site.sponsor.url || "", v => site.sponsor.url = v);
    bindField("shop-on", () => !!site.shop.on, v => site.shop.on = v, "checked");
    bindField("shop-title", () => site.shop.title || "", v => site.shop.title = v);
    bindField("nl-on", () => !!site.newsletter.on, v => site.newsletter.on = v, "checked");
    bindField("nl-url", () => site.newsletter.url || "", v => site.newsletter.url = v);
    bindField("nl-pitch", () => site.newsletter.pitch || "", v => site.newsletter.pitch = v);
    bindField("pod-on", () => !!site.podcast.on, v => site.podcast.on = v, "checked");
    bindField("pod-title", () => site.podcast.title || "", v => site.podcast.title = v);
    bindField("pod-url", () => site.podcast.url || "", v => site.podcast.url = v);
    $("shop-add").addEventListener("click", () => { site.shop.links.push({ label: "", url: "" }); markDirty(); renderShopLinks(); });

    const origin = location.origin;
    $("bm").href = "javascript:location.href='" + origin + "/admin/?add='+encodeURIComponent(location.href)+'&t='+encodeURIComponent(document.title)";
    $("bm").addEventListener("click", (e) => e.preventDefault());

    renderSlots(); renderShopLinks(); loadAuto();
    wireUpload("a");

    // Prefill from the quick-add bookmark
    const q = new URLSearchParams(location.search);
    if (q.get("add")) {
      $("a-url").value = q.get("add");
      $("a-headline").value = (q.get("t") || "").replace(/\s*[|–—-]\s*[^|–—-]*$/, "");
      try { $("a-source").value = new URL(q.get("add")).hostname.replace(/^www\./, ""); } catch {}
      history.replaceState(null, "", "/admin/");
      $("a-headline").focus(); $("a-headline").select();
    }
  }

  function alertBox(t) { setMsg(t); }

  // Edit dialog
  function openEdit(s) {
    editingId = s.id;
    $("e-headline").value = s.headline; $("e-url").value = s.url; $("e-source").value = s.source || "";
    fillExtras("e", s); $("e-upmsg").textContent = "";
    $("dlg").classList.add("open"); $("e-headline").focus();
  }
  wireUpload("e");
  $("e-cancel").addEventListener("click", () => $("dlg").classList.remove("open"));
  $("edit").addEventListener("submit", (e) => {
    e.preventDefault();
    const s = site.stories.find(x => x.id === editingId);
    const url = safeUrl($("e-url").value.trim());
    if (!s || !url || !$("e-headline").value.trim()) return;
    s.headline = $("e-headline").value.trim(); s.url = url; s.source = $("e-source").value.trim();
    Object.assign(s, readExtras("e"));
    $("dlg").classList.remove("open"); markDirty(); renderSlots();
  });

  $("publish").addEventListener("click", async () => {
    if (saving || !dirty) return;
    saving = true; $("publish").disabled = true; setMsg("Publishing…");
    try {
      const res = await fetch("/admin/api/site", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...site, baseUpdatedAt }), credentials: "same-origin" });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        $("publish").disabled = false;
        setMsg("⚠ Someone published a newer version since you opened this. Copy any new stories, then reload this page and add them again.");
        saving = false;
        return;
      }
      if (!res.ok) throw new Error(data.error || ("Error " + res.status));
      site = data.site; baseUpdatedAt = site.updatedAt; dirty = false;
      setMsg("Published ✓ " + new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
      renderSlots(); renderShopLinks(); renderAuto();
    } catch (e) {
      $("publish").disabled = false;
      setMsg("Couldn't publish: " + e.message);
    } finally { saving = false; }
  });

  (async function boot() {
    try {
      const res = await fetch("/admin/api/site", { credentials: "same-origin", cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || ("Error " + res.status));
      site = data.site;
      baseUpdatedAt = site.updatedAt || null;
      site.stories = site.stories || [];
      site.sponsor = site.sponsor || { on: false, name: "", url: "" };
      site.shop = site.shop || { on: false, title: "SHOP THE HORNS", links: [] };
      site.shop.links = site.shop.links || [];
      site.tickets = site.tickets || { on: false, link: "" };
      site.newsletter = site.newsletter || { on: false, url: "", pitch: "" };
      site.podcast = site.podcast || { on: false, title: "", url: "" };
      $("who").textContent = data.editor ? "Signed in as " + data.editor : "";
      build();
      setMsg(site.updatedAt ? "Last published " + new Date(site.updatedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Not published yet");
    } catch (e) {
      $("loading").textContent = "Couldn't open the editor: " + e.message;
    }
  })();
})();
