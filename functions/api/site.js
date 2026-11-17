// GET /api/site — public: the front page's content.
import { json, loadSite } from "../_lib.js";
import { SEED } from "../_seed.js";

export async function onRequestGet({ env }) {
  const site = await loadSite(env, SEED);
  return json(site, 200, { "cache-control": "public, max-age=30" });
}
