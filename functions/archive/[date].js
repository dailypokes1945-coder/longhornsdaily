// GET /archive/YYYY-MM-DD — that day's headlines, as they appeared on the front page.
import { DATE_RE, listDays, dayPage, loadRundowns } from "../_archive.js";

const notFound = () => new Response("Not found", { status: 404, headers: { "content-type": "text/plain" } });

export async function onRequestGet({ params, env, request }) {
  const date = String(params.date || "");
  if (!DATE_RE.test(date) || !env.SITE) return notFound();
  const raw = await env.SITE.get("day:" + date);
  if (!raw) return notFound();
  let snap; try { snap = JSON.parse(raw); } catch { return notFound(); }
  if (!snap || !Array.isArray(snap.stories)) return notFound();
  const origin = new URL(request.url).origin;
  const [days, rundowns] = await Promise.all([listDays(env).catch(() => []), loadRundowns(env, origin)]);
  const asc = days.slice().sort();
  const i = asc.indexOf(date);
  const prev = i > 0 ? asc[i - 1] : null;
  const next = i >= 0 && i < asc.length - 1 ? asc[i + 1] : null;
  const rundown = typeof rundowns[date] === "string" ? rundowns[date].trim().slice(0, 600) : "";
  return new Response(dayPage(snap, rundown, prev, next), {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" }
  });
}
