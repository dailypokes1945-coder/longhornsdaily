// GET /archive/ — list of every archived day.
import { listDays, indexPage } from "../_archive.js";

export async function onRequestGet({ env }) {
  const days = await listDays(env).catch(() => []);
  return new Response(indexPage(days), {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" }
  });
}
