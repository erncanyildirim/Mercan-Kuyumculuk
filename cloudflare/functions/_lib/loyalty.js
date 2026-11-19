// Coupons, coupon use at the till, and member notifications. Each is a small JSON list in KV;
// a jewelry store has tens of coupons and hundreds of messages, which fits one KV value well.
import { newId } from "./crypto.js";
import { AdminError } from "./staff.js";

const COUPONS = "coupons";
const REDEEMED = "redemptions";
const NOTICES = "notices";
const MAX_NOTICES = 300;
const MAX_REDEMPTIONS = 5000;

/** Coupon codes are plain A-Z/0-9 so they can be typed on any keyboard: "hoşgeldin" -> "HOSGELDIN". */
export function codeOf(v) {
  const map = { ç: "c", ğ: "g", ı: "i", İ: "i", ö: "o", ş: "s", ü: "u", Ç: "c", Ğ: "g", Ö: "o", Ş: "s", Ü: "u" };
  return String(v ?? "").replace(/[çğıİöşüÇĞÖŞÜ]/g, (c) => map[c]).toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 20);
}

const KINDS = new Set(["percent", "amount", "gram", "gift"]);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

async function readList(env, key) {
  try { return JSON.parse((await env.CONFIG.get(key)) || "[]"); } catch { return []; }
}
const writeList = (env, key, list) => env.CONFIG.put(key, JSON.stringify(list));

function text(v, max, field, required = false) {
  const s = String(v ?? "").trim();
  if (required && !s) throw new AdminError(`${field} boş olamaz`);
  if (s.length > max) throw new AdminError(`${field} en fazla ${max} karakter olabilir`);
  return s;
}

function phones(list) {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.map((p) => String(p).replace(/\D/g, "")).filter((p) => /^905\d{9}$/.test(p)))].slice(0, 2000);
}

// ---------- coupons ----------

export async function listCoupons(env) {
  return readList(env, COUPONS);
}

/**
 * kind: percent (% off labor/price), amount (₺ off), gram (₺ off per gram), gift (free item / text only).
 * audience: all members, or the listed phones.
 */
export function cleanCoupon(input, existing) {
  const kind = KINDS.has(input.kind) ? input.kind : "amount";
  const value = kind === "gift" ? 0 : Number(String(input.value ?? "").replace(",", "."));
  if (kind !== "gift" && !(value > 0)) throw new AdminError("İndirim değeri 0'dan büyük olmalı");
  if (kind === "percent" && value > 100) throw new AdminError("Yüzde indirim en fazla 100 olabilir");
  const validFrom = DATE.test(input.validFrom) ? input.validFrom : "";
  const validTo = DATE.test(input.validTo) ? input.validTo : "";
  if (validFrom && validTo && validTo < validFrom) throw new AdminError("Bitiş tarihi başlangıçtan önce olamaz");
  const code = codeOf(text(input.code, 30, "Kupon kodu"));
  return {
    id: existing?.id ?? newId("kupon"),
    code: code || (existing?.code ?? `MERCAN${Math.floor(1000 + Math.random() * 9000)}`),
    title: text(input.title, 60, "Kupon başlığı", true),
    description: text(input.description, 300, "Açıklama"),
    kind,
    value,
    audience: input.audience === "selected" ? "selected" : "all",
    members: input.audience === "selected" ? phones(input.members) : [],
    validFrom,
    validTo,
    perMember: Math.max(1, Math.min(100, Number(input.perMember) || 1)),
    totalLimit: Math.max(0, Math.min(100000, Number(input.totalLimit) || 0)),
    active: input.active !== false,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    createdBy: existing?.createdBy ?? "",
  };
}

export async function saveCoupon(env, input, user) {
  const list = await listCoupons(env);
  const i = input.id ? list.findIndex((c) => c.id === input.id) : -1;
  const coupon = cleanCoupon(input, i >= 0 ? list[i] : null);
  if (i < 0) coupon.createdBy = user.name;
  if (list.some((c) => c.code === coupon.code && c.id !== coupon.id)) throw new AdminError("Bu kupon kodu zaten kullanılıyor");
  if (i >= 0) list[i] = coupon; else list.unshift(coupon);
  await writeList(env, COUPONS, list);
  return coupon;
}

export async function deleteCoupon(env, id) {
  const list = await listCoupons(env);
  await writeList(env, COUPONS, list.filter((c) => c.id !== id));
}

export async function listRedemptions(env) {
  return readList(env, REDEEMED);
}

const today = () => new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10); // Istanbul date

export function couponOpen(c, now = today()) {
  return c.active && (!c.validFrom || c.validFrom <= now) && (!c.validTo || c.validTo >= now);
}

export const couponFor = (c, phone) => c.audience === "all" || c.members.includes(phone);

/** Marks a coupon as used by a member at the till. */
export async function redeemCoupon(env, { couponId, code, phone, note }, user) {
  const coupons = await listCoupons(env);
  const c = coupons.find((x) => x.id === couponId || (code && x.code === codeOf(code)));
  if (!c) throw new AdminError("Kupon bulunamadı", 404);
  if (!couponOpen(c)) throw new AdminError("Kupon şu anda geçerli değil (pasif ya da tarihi dışında)");
  if (!couponFor(c, phone)) throw new AdminError("Bu kupon bu üyeye tanımlı değil");
  const used = await listRedemptions(env);
  const mine = used.filter((r) => r.couponId === c.id && r.phone === phone).length;
  if (mine >= c.perMember) throw new AdminError(`Üye bu kuponu zaten ${mine} kez kullanmış (sınır ${c.perMember})`);
  if (c.totalLimit && used.filter((r) => r.couponId === c.id).length >= c.totalLimit) throw new AdminError("Kuponun toplam kullanım sınırı doldu");
  const entry = { id: newId("kullanim"), couponId: c.id, code: c.code, phone, at: new Date().toISOString(), by: user.name, note: text(note, 120, "Not") };
  used.unshift(entry);
  await writeList(env, REDEEMED, used.slice(0, MAX_REDEMPTIONS));
  return { coupon: c, entry };
}

/** The coupons a member can see, with how many times each was used. */
export async function memberCoupons(env, phone) {
  const [coupons, used] = await Promise.all([listCoupons(env), listRedemptions(env)]);
  const now = today();
  return coupons
    .filter((c) => c.active && couponFor(c, phone) && (!c.validTo || c.validTo >= now))
    .map((c) => {
      const usedCount = used.filter((r) => r.couponId === c.id && r.phone === phone).length;
      return {
        id: c.id, code: c.code, title: c.title, description: c.description, kind: c.kind, value: c.value,
        validFrom: c.validFrom, validTo: c.validTo, perMember: c.perMember, used: usedCount,
        usable: usedCount < c.perMember && couponOpen(c, now),
      };
    });
}

// ---------- notifications ----------

export async function listNotices(env) {
  return readList(env, NOTICES);
}

export async function sendNotice(env, input, user) {
  const notice = {
    id: newId("bildirim"),
    title: text(input.title, 80, "Başlık", true),
    body: text(input.body, 1000, "Mesaj", true),
    audience: input.audience === "selected" ? "selected" : "all",
    members: input.audience === "selected" ? phones(input.members) : [],
    link: text(input.link, 200, "Bağlantı"),
    at: new Date().toISOString(),
    by: user.name,
  };
  if (notice.audience === "selected" && !notice.members.length) throw new AdminError("En az bir üye seçin");
  if (notice.link && !/^https:\/\//.test(notice.link)) throw new AdminError("Bağlantı https:// ile başlamalı");
  const list = await listNotices(env);
  list.unshift(notice);
  await writeList(env, NOTICES, list.slice(0, MAX_NOTICES));
  return notice;
}

export async function deleteNotice(env, id) {
  const list = await listNotices(env);
  await writeList(env, NOTICES, list.filter((n) => n.id !== id));
}

/** Notifications for a member (newest first), only those sent after they joined. */
export async function memberNotices(env, member) {
  const list = await listNotices(env);
  return list
    .filter((n) => (n.audience === "all" || n.members.includes(member.phone)) && n.at >= (member.createdAt || ""))
    .slice(0, 100)
    .map((n) => ({ id: n.id, title: n.title, body: n.body, link: n.link, at: n.at, read: !!member.readUntil && n.at <= member.readUntil }));
}
