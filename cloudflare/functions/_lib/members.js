// Customer accounts ("üyeler"): phone + password, stored in KV under member:<phone>.
// Members get members-only prices (config.memberDeals), coupons and in-app notifications.
import { bearer } from "./auth.js";
import { json } from "./config.js";
import { b64url, fromB64url, hashPassword, verifyHash } from "./crypto.js";

const enc = new TextEncoder();
const TOKEN_TTL_MS = 180 * 24 * 60 * 60 * 1000; // stay signed in for six months
export const MIN_MEMBER_PASSWORD = 6;
const MAX_FAILURES = 10;
const LOCK_SECONDS = 15 * 60;

export class MemberError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Turkish mobile numbers in one canonical form: 905XXXXXXXXX. */
export function normalizePhone(input) {
  let d = String(input ?? "").replace(/\D/g, "");
  if (d.startsWith("0")) d = "90" + d.slice(1);
  else if (d.length === 10 && d.startsWith("5")) d = "90" + d;
  if (!/^905\d{9}$/.test(d)) throw new MemberError("Geçerli bir cep telefonu numarası girin (05XX XXX XX XX)");
  return d;
}

export function cleanName(input) {
  const name = String(input ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 2) throw new MemberError("Adınızı ve soyadınızı yazın");
  if (name.length > 60) throw new MemberError("Ad soyad en fazla 60 karakter olabilir");
  return name;
}

export function checkPasswordRules(password) {
  if (typeof password !== "string" || password.length < MIN_MEMBER_PASSWORD) {
    throw new MemberError(`Şifre en az ${MIN_MEMBER_PASSWORD} karakter olmalı`);
  }
  if (password.length > 200) throw new MemberError("Şifre çok uzun");
}

const memberKey = (phone) => `member:${phone}`;

export async function getMember(env, phone) {
  const text = await env.CONFIG.get(memberKey(phone));
  return text ? JSON.parse(text) : null;
}

export async function putMember(env, m) {
  // Metadata lets the admin list members without reading every record.
  await env.CONFIG.put(memberKey(m.phone), JSON.stringify(m), {
    metadata: { name: m.name, createdAt: m.createdAt, disabled: !!m.disabled, lastSeen: m.lastSeen ?? null, tags: (m.tags || []).slice(0, 6) },
  });
}

export async function createMember(env, { name, phone, password }) {
  const n = cleanName(name);
  const p = normalizePhone(phone);
  checkPasswordRules(password);
  if (await getMember(env, p)) throw new MemberError("Bu telefon numarası ile zaten üye olunmuş. Giriş yapın.", 409);
  const member = {
    phone: p,
    name: n,
    password: await hashPassword(password),
    createdAt: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    disabled: false,
    tags: [],
    note: "",
    readUntil: null,
    // Changing this invalidates every token issued before (logout everywhere / admin disable).
    session: b64url(crypto.getRandomValues(new Uint8Array(9))),
  };
  await putMember(env, member);
  return member;
}

export async function verifyMemberPassword(member, password) {
  return verifyHash(String(password ?? ""), member.password);
}

export async function setMemberPassword(member, password) {
  checkPasswordRules(password);
  member.password = await hashPassword(password);
  member.session = b64url(crypto.getRandomValues(new Uint8Array(9)));
}

export async function deleteMember(env, phone) {
  await env.CONFIG.delete(memberKey(phone));
}

/** Lists members for the admin panel (newest first). */
export async function listMembers(env) {
  const out = [];
  let cursor;
  do {
    const page = await env.CONFIG.list({ prefix: "member:", cursor });
    for (const k of page.keys) {
      out.push({
        phone: k.name.slice("member:".length),
        name: k.metadata?.name ?? "",
        createdAt: k.metadata?.createdAt ?? "",
        lastSeen: k.metadata?.lastSeen ?? null,
        disabled: !!k.metadata?.disabled,
        tags: k.metadata?.tags ?? [],
      });
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return out.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

// ---------- tokens ----------

async function hmacKey(env) {
  return crypto.subtle.importKey("raw", enc.encode(`mercan-member:${env.SESSION_SECRET ?? ""}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function issueMemberToken(env, member, now = Date.now()) {
  const payload = enc.encode(JSON.stringify({ p: member.phone, s: member.session, exp: now + TOKEN_TTL_MS }));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(env), payload);
  return `${b64url(payload)}.${b64url(sig)}`;
}

/** Returns the signed-in member, or throws MemberError(401). */
export async function requireMember(request, env) {
  const token = bearer(request);
  if (!token || !token.includes(".")) throw new MemberError("Giriş yapmanız gerekiyor", 401);
  const [p, s] = token.split(".");
  let data;
  try {
    const payload = fromB64url(p);
    if (!(await crypto.subtle.verify("HMAC", await hmacKey(env), fromB64url(s), payload))) throw new Error();
    data = JSON.parse(new TextDecoder().decode(payload));
  } catch {
    throw new MemberError("Oturumunuz geçersiz, tekrar giriş yapın", 401);
  }
  if (typeof data.exp !== "number" || data.exp < Date.now()) throw new MemberError("Oturumunuzun süresi doldu, tekrar giriş yapın", 401);
  const member = await getMember(env, data.p);
  if (!member || member.session !== data.s) throw new MemberError("Oturumunuz kapatıldı, tekrar giriş yapın", 401);
  if (member.disabled) throw new MemberError("Üyeliğiniz mağaza tarafından durduruldu", 403);
  return member;
}

// ---------- brute-force protection (per IP) ----------

const failKey = (request) => `member-fail:${request.headers.get("CF-Connecting-IP") || "local"}`;

export async function guardFailures(request, env) {
  const n = Number(await env.CONFIG.get(failKey(request)).catch(() => 0)) || 0;
  if (n >= MAX_FAILURES) throw new MemberError("Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin.", 429);
}

export async function recordMemberFailure(request, env) {
  try {
    const n = (Number(await env.CONFIG.get(failKey(request))) || 0) + 1;
    await env.CONFIG.put(failKey(request), String(n), { expirationTtl: LOCK_SECONDS });
  } catch {
    // KV quota or outage: do not block the request
  }
  await new Promise((r) => setTimeout(r, 600));
}

/** Public fields of a member, as returned to the apps and the site. */
export function profile(member) {
  return { name: member.name, phone: member.phone, createdAt: member.createdAt };
}

/** Wraps a handler so MemberError becomes a JSON error response; also answers CORS for the apps. */
export function handle(fn) {
  return async (context) => {
    try {
      return withCors(await fn(context));
    } catch (e) {
      if (e instanceof MemberError) return withCors(json({ error: e.message }, { status: e.status }));
      throw e;
    }
  };
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

function withCors(res) {
  const r = new Response(res.body, res);
  for (const [k, v] of Object.entries(CORS)) r.headers.set(k, v);
  r.headers.set("Cache-Control", "no-store");
  return r;
}

export function corsPreflight() {
  return new Response(null, { status: 204, headers: CORS });
}
