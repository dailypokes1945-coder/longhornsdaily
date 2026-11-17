// Verifies the Cloudflare Access login token on admin requests.
// Cloudflare Access sits in front of /admin and /api/admin and adds a signed
// token (Cf-Access-Jwt-Assertion) once you've logged in. We check the signature,
// expiry, audience and email here as a second lock, and refuse if anything is
// missing — so the site fails closed if Access is ever misconfigured.
//
// Required environment variables (Cloudflare Pages → Settings → Variables):
//   ACCESS_TEAM_DOMAIN  e.g. longhornsdaily.cloudflareaccess.com
//   ACCESS_AUD          the Application Audience (AUD) tag from the Access app
//   ADMIN_EMAILS        comma-separated list of emails allowed to edit

function b64urlToBytes(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
const decodeJson = (part) => JSON.parse(new TextDecoder().decode(b64urlToBytes(part)));

let certCache = { at: 0, keys: null, domain: "" };
async function getKeys(domain, fetchImpl) {
  const now = Date.now();
  if (certCache.keys && certCache.domain === domain && now - certCache.at < 10 * 60 * 1000) return certCache.keys;
  const res = await fetchImpl(`https://${domain}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error("Could not fetch Access certs");
  const { keys } = await res.json();
  certCache = { at: now, keys, domain };
  return keys;
}

export async function verifyAccess(request, env, fetchImpl = fetch) {
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token || !env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD || !env.ADMIN_EMAILS) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const header = decodeJson(parts[0]);
    const payload = decodeJson(parts[1]);
    if (header.alg !== "RS256") return null;
    const keys = await getKeys(env.ACCESS_TEAM_DOMAIN, fetchImpl);
    const jwk = keys.find(k => k.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey(
      "jwk", { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]
    );
    const ok = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5", key, b64urlToBytes(parts[2]),
      new TextEncoder().encode(parts[0] + "." + parts[1])
    );
    if (!ok) return null;
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== "number" || payload.exp < now) return null;
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!aud.includes(env.ACCESS_AUD)) return null;
    const allowed = env.ADMIN_EMAILS.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
    const email = String(payload.email || "").toLowerCase();
    if (!allowed.includes(email)) return null;
    return { email };
  } catch {
    return null;
  }
}
