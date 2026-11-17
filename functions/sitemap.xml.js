// GET /sitemap.xml — the front page, the archive list and every archived day.
import { listDays, sitemapXml } from "./_archive.js";

export async function onRequestGet({ env }) {
  const days = await listDays(env).catch(() => []);
  return new Response(sitemapXml(days), {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" }
  });
}
