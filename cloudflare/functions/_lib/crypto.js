// Password hashing (PBKDF2-SHA256) and small base64url helpers shared by members and staff.
const enc = new TextEncoder();
const ITERATIONS = 100_000;

export function b64url(bytes) {
  let s = "";
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromB64url(text) {
  const s = atob(String(text).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  return b64url(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256));
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt: b64url(salt), iterations: ITERATIONS, hash: await pbkdf2(password, salt, ITERATIONS) };
}

export async function sameText(a, b) {
  const [x, y] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(a)), crypto.subtle.digest("SHA-256", enc.encode(b))]);
  const u = new Uint8Array(x), v = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < u.length; i++) diff |= u[i] ^ v[i];
  return diff === 0;
}

export async function verifyHash(password, record) {
  if (!record?.salt || !record?.hash) return false;
  return sameText(await pbkdf2(password, fromB64url(record.salt), record.iterations || ITERATIONS), record.hash);
}

export const newId = (prefix) => `${prefix}-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
