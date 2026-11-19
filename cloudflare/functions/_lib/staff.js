// Admin panel users. The owner signs in with the ADMIN_PASSWORD secret and may do everything.
// Staff accounts (personel) are created by the owner in the panel, each with its own password and
// a chosen set of permissions; they are stored in KV under staff:<username>.
import { bearer, verifyToken } from "./auth.js";
import { json } from "./config.js";
import { hashPassword, verifyHash } from "./crypto.js";

/** Permission keys and the labels the panel shows. "staff" (managing staff) is owner-only. */
export const PERMISSIONS = {
  dashboard: "Gösterge paneli",
  prices: "Fiyat ayarları",
  site: "Web sitesi ve koleksiyon",
  store: "Mağaza bilgileri ve duyuru",
  "members.view": "Üyeleri görüntüleme",
  "members.edit": "Üyeleri düzenleme",
  memberPrices: "Üye fiyatları",
  coupons: "Kuponlar",
  "coupons.redeem": "Kupon kullandırma (kasada)",
  notify: "Bildirim gönderme",
  logs: "İşlem geçmişi",
  settings: "Gelişmiş ayarlar",
};
export const ALL = Object.keys(PERMISSIONS);

const USER = /^[a-z0-9._-]{3,30}$/;
export const MIN_STAFF_PASSWORD = 8;
const key = (u) => `staff:${u}`;

export class AdminError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function cleanUsername(input) {
  const u = String(input ?? "").trim().toLocaleLowerCase("tr").replace(/ı/g, "i");
  if (!USER.test(u)) throw new AdminError("Kullanıcı adı 3-30 karakter olmalı (harf, rakam, . _ -)");
  if (u === "owner" || u === "admin") throw new AdminError("Bu kullanıcı adı kullanılamaz");
  return u;
}

export function cleanPerms(list) {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.filter((p) => ALL.includes(p)))];
}

export async function getStaff(env, username) {
  const t = await env.CONFIG.get(key(username));
  return t ? JSON.parse(t) : null;
}

export async function listStaff(env) {
  const out = [];
  let cursor;
  do {
    const page = await env.CONFIG.list({ prefix: "staff:", cursor });
    for (const k of page.keys) {
      const s = await getStaff(env, k.name.slice(6));
      if (s) out.push(publicStaff(s));
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return out.sort((a, b) => a.name.localeCompare(b.name, "tr"));
}

export function publicStaff(s) {
  return { username: s.username, name: s.name, perms: s.perms, active: s.active !== false, createdAt: s.createdAt, lastLogin: s.lastLogin ?? null };
}

export async function saveStaff(env, input, existing) {
  const username = existing?.username ?? cleanUsername(input.username);
  const name = String(input.name ?? "").trim().slice(0, 60) || username;
  const record = {
    username,
    name,
    perms: cleanPerms(input.perms),
    active: input.active !== false,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    lastLogin: existing?.lastLogin ?? null,
    password: existing?.password ?? null,
    // A new session id signs the person out everywhere (password change, deactivation, permission change).
    session: crypto.randomUUID(),
  };
  if (input.password) {
    if (String(input.password).length < MIN_STAFF_PASSWORD) throw new AdminError(`Şifre en az ${MIN_STAFF_PASSWORD} karakter olmalı`);
    record.password = await hashPassword(String(input.password));
  }
  if (!record.password) throw new AdminError("Yeni personel için şifre belirleyin");
  await env.CONFIG.put(key(username), JSON.stringify(record));
  return record;
}

export async function deleteStaff(env, username) {
  await env.CONFIG.delete(key(username));
}

export async function checkStaffLogin(env, username, password) {
  let u;
  try { u = cleanUsername(username); } catch { return null; }
  const s = await getStaff(env, u);
  if (!s || !s.password || !(await verifyHash(String(password ?? ""), s.password))) return null;
  if (s.active === false) throw new AdminError("Hesabınız devre dışı. Mağaza sahibiyle görüşün.", 403);
  s.lastLogin = new Date().toISOString();
  await env.CONFIG.put(key(u), JSON.stringify(s));
  return s;
}

/**
 * The signed-in panel user: {owner, username, name, perms}. Staff tokens are checked against the
 * stored record on every request, so a deactivated person or changed permissions apply at once.
 */
export async function adminUser(request, env) {
  const claims = await verifyToken(env, bearer(request));
  if (!claims) return null;
  if (!claims.u) return { owner: true, username: "owner", name: "Mağaza sahibi", perms: [...ALL, "staff"] };
  const s = await getStaff(env, claims.u);
  if (!s || s.active === false || s.session !== claims.s) return null;
  return { owner: false, username: s.username, name: s.name, perms: s.perms };
}

export const can = (user, perm) => !!user && (user.owner || user.perms.includes(perm));

/**
 * Wraps an admin handler: answers 401 without a valid session and 403 without [perm]
 * (null = any signed-in user). The handler receives ctx.user.
 */
export function adminHandler(perm, fn) {
  return async (ctx) => {
    if (!ctx.env.ADMIN_PASSWORD) return json({ error: "ADMIN_PASSWORD tanımlı değil" }, { status: 503 });
    const user = await adminUser(ctx.request, ctx.env);
    if (!user) return json({ error: "Oturum süresi doldu, tekrar giriş yapın" }, { status: 401 });
    const perms = Array.isArray(perm) ? perm : perm ? [perm] : [];
    if (perms.length && !perms.some((p) => can(user, p))) {
      return json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
    }
    try {
      const res = await fn({ ...ctx, user });
      res.headers.set("Cache-Control", "no-store");
      return res;
    } catch (e) {
      if (e instanceof AdminError) return json({ error: e.message }, { status: e.status });
      throw e;
    }
  };
}

// ---------- audit log ----------

const LOG_KEY = "auditlog";
const LOG_MAX = 500;

/** Records who did what; best effort (never fails the request). */
export async function audit(env, user, action, detail = "") {
  try {
    const list = JSON.parse((await env.CONFIG.get(LOG_KEY)) || "[]");
    list.unshift({ at: new Date().toISOString(), by: user?.name ?? "?", user: user?.username ?? "?", action, detail: String(detail).slice(0, 300) });
    await env.CONFIG.put(LOG_KEY, JSON.stringify(list.slice(0, LOG_MAX)));
  } catch {
    // ignore
  }
}

export async function readLog(env) {
  return JSON.parse((await env.CONFIG.get(LOG_KEY)) || "[]");
}
