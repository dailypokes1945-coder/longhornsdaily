// GET /admin/api/ogimage?url=<article link> — the editor's "Use article photo" button.
// Reads the article page and returns its own lead photo link (og:image / twitter:image)
// plus the outlet's name for the credit. Nothing is downloaded or stored: the photo stays
// on the outlet's server and the front page just links to it.
import { json } from "../../_lib.js";
import { verifyAccess } from "../../_access.js";

const MAX_BYTES = 1024 * 1024; // the <head> is near the top; 1 MB is plenty

function decode(s) {
  return String(s || "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&#x2F;/gi, "/").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}

function metaContent(html, names) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const name of names) {
    for (const tag of tags) {
      const key = (tag.match(/\b(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i) || [])[1];
      if (!key || key.toLowerCase() !== name) continue;
      const val = (tag.match(/\bcontent\s*=\s*"([^"]*)"/i) || tag.match(/\bcontent\s*=\s*'([^']*)'/i) || [])[1];
      if (val && val.trim()) return decode(val);
    }
  }
  return "";
}

export async function onRequestGet({ request, env }) {
  if (!(await verifyAccess(request, env))) return json({ error: "Not authorized" }, 401);
  let page;
  try { page = new URL(new URL(request.url).searchParams.get("url") || ""); } catch { return json({ error: "Add the story's full link first" }, 400); }
  if (page.protocol !== "https:" && page.protocol !== "http:") return json({ error: "Add the story's full link first" }, 400);

  let res;
  try {
    res = await fetch(page.href, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; LonghornsDailyEditor/1.0; +https://longhornsdaily.com)", accept: "text/html,application/xhtml+xml" },
      redirect: "follow", cf: { cacheTtl: 300 }
    });
  } catch { return json({ error: "Couldn't open that article" }, 502); }
  if (!res.ok) return json({ error: "The article's site answered with error " + res.status }, 502);

  // Read only the first part of the page
  const reader = res.body.getReader(); const chunks = []; let size = 0;
  while (size < MAX_BYTES) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); size += value.byteLength; }
  try { reader.cancel(); } catch {}
  const html = new TextDecoder().decode(chunks.length === 1 ? chunks[0] : (() => { const all = new Uint8Array(size); let o = 0; for (const c of chunks) { all.set(c, o); o += c.byteLength; } return all; })());

  let image = metaContent(html, ["og:image:secure_url", "og:image", "og:image:url", "twitter:image", "twitter:image:src"]);
  if (!image) return json({ error: "That article doesn't list a lead photo" }, 404);
  try { image = new URL(image, res.url || page.href); } catch { return json({ error: "That article's photo link isn't valid" }, 404); }
  if (image.protocol === "http:") image.protocol = "https:";
  if (image.protocol !== "https:") return json({ error: "That article's photo link isn't valid" }, 404);

  const site = metaContent(html, ["og:site_name", "application-name"]) || page.hostname.replace(/^www\./, "");
  const alt = metaContent(html, ["og:image:alt", "twitter:image:alt"]);
  return json({ ok: true, image: image.href, credit: "Photo: " + site.slice(0, 70), alt: alt.slice(0, 300) });
}
