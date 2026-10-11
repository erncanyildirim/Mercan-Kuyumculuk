// Single-admin authentication: a password (secret ADMIN_PASSWORD) is exchanged for a
// short-lived HMAC-signed token. No user data is stored.

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_FAILURES = 8;
const LOCK_SECONDS = 15 * 60;

const enc = new TextEncoder();

function b64url(bytes) {
  let s = "";
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(text) {
  const s = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

async function hmacKey(env) {
  const secret = env.SESSION_SECRET || env.ADMIN_PASSWORD;
  return crypto.subtle.importKey("raw", enc.encode(`mercan-admin:${secret}`), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

/** Constant-time comparison of two strings via their SHA-256 digests. */
export async function safeEqual(a, b) {
  const [da, db] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const x = new Uint8Array(da);
  const y = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

export async function issueToken(env, now = Date.now()) {
  const payload = enc.encode(JSON.stringify({ exp: now + TOKEN_TTL_MS }));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(env), payload);
  return `${b64url(payload)}.${b64url(sig)}`;
}

export async function verifyToken(env, token, now = Date.now()) {
  if (!token || typeof token !== "string" || !token.includes(".")) return false;
  const [p, s] = token.split(".");
  try {
    const payload = fromB64url(p);
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(env), fromB64url(s), payload);
    if (!ok) return false;
    const { exp } = JSON.parse(new TextDecoder().decode(payload));
    return typeof exp === "number" && exp > now;
  } catch {
    return false;
  }
}

export function bearer(request) {
  const h = request.headers.get("Authorization") || "";
  return h.startsWith("Bearer ") ? h.slice(7) : null;
}

/** Returns a 401 response when the request is not authenticated, otherwise null. */
export async function requireAdmin(request, env) {
  if (!env.ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ error: "ADMIN_PASSWORD tanımlı değil" }), { status: 503 });
  }
  if (await verifyToken(env, bearer(request))) return null;
  return new Response(JSON.stringify({ error: "Oturum süresi doldu, tekrar giriş yapın" }), {
    status: 401,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function failureKey(request) {
  return `login-fail:${request.headers.get("CF-Connecting-IP") || "local"}`;
}

export async function isLocked(request, env) {
  const n = Number(await env.CONFIG.get(failureKey(request))) || 0;
  return n >= MAX_FAILURES;
}

export async function recordFailure(request, env) {
  const key = failureKey(request);
  const n = (Number(await env.CONFIG.get(key)) || 0) + 1;
  await env.CONFIG.put(key, String(n), { expirationTtl: LOCK_SECONDS });
}

export async function clearFailures(request, env) {
  await env.CONFIG.delete(failureKey(request));
}
