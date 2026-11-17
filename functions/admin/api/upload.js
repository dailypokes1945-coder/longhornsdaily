// POST /admin/api/upload — the editor uploads a photo (raw image bytes).
// Stored in the SITE KV namespace under "img:<id>" and served at /photos/<id>.
import { json } from "../../_lib.js";
import { verifyAccess } from "../../_access.js";

const TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
const MAX = 5 * 1024 * 1024;

export async function onRequestPost({ request, env }) {
  if (!(await verifyAccess(request, env))) return json({ error: "Not authorized" }, 401);
  if (!env.SITE) return json({ error: "Storage isn't connected" }, 500);
  const type = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!TYPES[type]) return json({ error: "Use a JPG, PNG, WebP or GIF image" }, 415);
  const buf = await request.arrayBuffer();
  if (!buf.byteLength) return json({ error: "Empty file" }, 400);
  if (buf.byteLength > MAX) return json({ error: "Photo is too big (max 5 MB)" }, 413);
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + "." + TYPES[type];
  await env.SITE.put("img:" + id, buf, { metadata: { type } });
  return json({ ok: true, url: "/photos/" + id });
}
