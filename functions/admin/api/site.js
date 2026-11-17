// GET  /admin/api/site — editor loads the current content (no caching)
// PUT  /admin/api/site — editor saves the whole page
// Both require a valid Cloudflare Access login from an allowed email.
import { json, loadSite, saveSite, sanitizeSite } from "../../_lib.js";
import { SEED } from "../../_seed.js";
import { verifyAccess } from "../../_access.js";

async function guard(request, env) {
  const who = await verifyAccess(request, env);
  if (!who) return { error: json({ error: "Not authorized. Log in through Cloudflare Access with an allowed email." }, 401) };
  if (!env.SITE) return { error: json({ error: "Storage isn't connected. Bind a KV namespace named SITE in Cloudflare Pages settings." }, 500) };
  return { who };
}

export async function onRequestGet({ request, env }) {
  const g = await guard(request, env);
  if (g.error) return g.error;
  const site = await loadSite(env, SEED);
  return json({ site, editor: g.who.email }, 200, { "cache-control": "no-store" });
}

export async function onRequestPut({ request, env }) {
  const g = await guard(request, env);
  if (g.error) return g.error;
  const text = await request.text();
  if (text.length > 512 * 1024) return json({ error: "Too large" }, 413);
  let body;
  try { body = JSON.parse(text); } catch { return json({ error: "Invalid JSON" }, 400); }
  // Don't let an editor that was opened earlier overwrite a newer publish.
  const current = await loadSite(env, SEED);
  if (current.updatedAt && body.baseUpdatedAt !== current.updatedAt && !body.force) {
    return json({ error: "conflict", message: "The page was published from somewhere else since you opened the editor.", updatedAt: current.updatedAt }, 409);
  }
  let site;
  try { site = sanitizeSite(body); } catch (e) { return json({ error: e.message }, 400); }
  await saveSite(env, site);
  return json({ ok: true, site }, 200, { "cache-control": "no-store" });
}
