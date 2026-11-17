// GET /photos/<id> — serves a photo uploaded from the editor.
export async function onRequestGet({ params, env }) {
  const id = String(params.id || "");
  if (!/^[a-z0-9]+\.(jpg|png|webp|gif)$/.test(id) || !env.SITE) return new Response("Not found", { status: 404 });
  const { value, metadata } = await env.SITE.getWithMetadata("img:" + id, { type: "arrayBuffer" });
  if (!value) return new Response("Not found", { status: 404 });
  return new Response(value, {
    headers: {
      "content-type": (metadata && metadata.type) || "image/jpeg",
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff"
    }
  });
}
