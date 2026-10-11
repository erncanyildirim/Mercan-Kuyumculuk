// Validation and storage of the jeweler's configuration (see docs/api-contract.md).
// The apps parse this document with RemoteConfig.kt; keep both in sync.

export const CONFIG_KEY = "config";

const MODES = new Set(["live", "adjust", "fixed"]);
const UNITS = new Set(["amount", "percent"]);
const STYLES = new Set(["info", "warning"]);
const CODE = /^[A-Z0-9_]{2,24}$/;
const TIME = /^([01]\d|2[0-4]):[0-5]\d$/;

export class ValidationError extends Error {}

function str(value, max, field) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new ValidationError(`${field} metin olmalı`);
  const s = value.trim();
  if (s.length > max) throw new ValidationError(`${field} en fazla ${max} karakter olabilir`);
  return s;
}

function num(value, field, { min = -Infinity, max = Infinity, optional = false } = {}) {
  if (value === undefined || value === null || value === "") {
    if (optional) return null;
    return 0;
  }
  const n = typeof value === "string" ? Number(value.replace(",", ".")) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) throw new ValidationError(`${field} sayı olmalı`);
  if (n < min || n > max) throw new ValidationError(`${field} ${min} ile ${max} arasında olmalı`);
  return n;
}

function bool(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

/** Returns a clean copy of [input] or throws ValidationError. */
export function sanitizeConfig(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ValidationError("Geçersiz ayar dosyası");
  }

  const feedIn = input.feed ?? {};
  const feedUrl = str(feedIn.url, 200, "Fiyat kaynağı adresi");
  if (feedUrl && !/^(wss|https):\/\//.test(feedUrl)) {
    throw new ValidationError("Fiyat kaynağı adresi wss:// veya https:// ile başlamalı");
  }
  const feed = { url: feedUrl || "wss://hrmsocketonly.haremaltin.com", enabled: bool(feedIn.enabled, true) };

  const s = input.store ?? {};
  const hours = Array.isArray(s.openingHours) ? s.openingHours : [];
  if (hours.length > 7) throw new ValidationError("En fazla 7 çalışma saati satırı olabilir");
  const store = {
    name: str(s.name, 60, "Mağaza adı") || "Mercan Kuyumculuk",
    city: str(s.city, 40, "Şehir"),
    phone: str(s.phone, 20, "Telefon"),
    whatsapp: str(s.whatsapp, 20, "WhatsApp"),
    address: str(s.address, 200, "Adres"),
    mapsQuery: str(s.mapsQuery, 120, "Harita araması"),
    lat: num(s.lat, "Enlem", { min: -90, max: 90, optional: true }),
    lng: num(s.lng, "Boylam", { min: -180, max: 180, optional: true }),
    hoursText: str(s.hoursText, 120, "Çalışma saatleri"),
    openingHours: hours.map((h, i) => {
      const days = Array.isArray(h?.days) ? [...new Set(h.days.map(Number))].filter((d) => d >= 1 && d <= 7).sort() : [];
      const open = str(h?.open, 5, `Saat ${i + 1} açılış`);
      const close = str(h?.close, 5, `Saat ${i + 1} kapanış`);
      if (!TIME.test(open) || !TIME.test(close)) throw new ValidationError(`Saat ${i + 1}: SS:DD biçiminde yazın`);
      if (open >= close) throw new ValidationError(`Saat ${i + 1}: kapanış açılıştan sonra olmalı`);
      return { days, open, close };
    }),
    instagram: str(s.instagram, 60, "Instagram"),
    email: str(s.email, 100, "E-posta"),
    website: str(s.website, 100, "Web sitesi"),
  };
  for (const [field, value] of [["Telefon", store.phone], ["WhatsApp", store.whatsapp]]) {
    if (value && !/^\+?[0-9 ]{10,16}$/.test(value)) throw new ValidationError(`${field} numarası geçersiz`);
  }

  const a = input.announcement ?? {};
  const announcement = {
    enabled: bool(a.enabled, false),
    text: str(a.text, 280, "Duyuru"),
    style: STYLES.has(a.style) ? a.style : "info",
  };

  const productsIn = input.products ?? {};
  if (typeof productsIn !== "object" || Array.isArray(productsIn)) throw new ValidationError("Ürün ayarları geçersiz");
  const products = {};
  for (const [code, p] of Object.entries(productsIn)) {
    if (!CODE.test(code)) throw new ValidationError(`Geçersiz ürün kodu: ${code}`);
    if (!p || typeof p !== "object") continue;
    const mode = MODES.has(p.mode) ? p.mode : "live";
    const unit = UNITS.has(p.adjUnit) ? p.adjUnit : "amount";
    const adjLimit = unit === "percent" ? 50 : 1_000_000;
    const entry = {
      mode,
      visible: bool(p.visible, true),
      buy: num(p.buy, `${code} alış`, { min: 0, max: 100_000_000, optional: true }),
      sell: num(p.sell, `${code} satış`, { min: 0, max: 100_000_000, optional: true }),
      buyAdj: num(p.buyAdj, `${code} alış farkı`, { min: -adjLimit, max: adjLimit }),
      sellAdj: num(p.sellAdj, `${code} satış farkı`, { min: -adjLimit, max: adjLimit }),
      adjUnit: unit,
    };
    if (mode === "fixed" && entry.buy === null && entry.sell === null) {
      throw new ValidationError(`${code}: sabit fiyat için en az bir fiyat girin`);
    }
    // Drop entries that change nothing, to keep the document small.
    const isDefault = mode === "live" && entry.visible && entry.buy === null && entry.sell === null &&
      entry.buyAdj === 0 && entry.sellAdj === 0;
    if (!isDefault) products[code] = entry;
  }

  return { schema: 1, feed, store, announcement, products };
}

export async function readConfig(env) {
  const text = await env.CONFIG.get(CONFIG_KEY);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function writeConfig(env, clean, previous) {
  const doc = {
    ...clean,
    version: (previous?.version ?? 0) + 1,
    updatedAt: new Date().toISOString(),
  };
  await env.CONFIG.put(CONFIG_KEY, JSON.stringify(doc));
  return doc;
}

export function json(body, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { ...init, headers });
}
