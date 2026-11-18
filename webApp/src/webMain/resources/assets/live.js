// Live prices for the website, the store TV board and the story card.
// Reads the jeweler's configuration from /api/config and the Harem Altın feed (Socket.IO v4 over a
// plain WebSocket, see HaremProtocol.kt). Overrides follow PricingEngine in
// shared/.../data/market/Pricing.kt, so the site shows exactly the prices the apps show.

const DEFAULT_FEED = "wss://hrmsocketonly.haremaltin.com";

// Same defaults as RemoteConfig.kt / admin.js, used until the first save.
export const DEFAULT_STORE = {
  name: "Mercan Kuyumculuk",
  city: "Osmaniye",
  phone: "+905436118088",
  whatsapp: "+905436118088",
  address: "Alibeyli Mah. Atatürk Cad., Eski Belediye civarı, Merkez / Osmaniye",
  mapsQuery: "Mercan Kuyumculuk Osmaniye",
  lat: null,
  lng: null,
  hoursText: "Hafta içi 09:00 – 19:00",
  openingHours: [{ days: [1, 2, 3, 4, 5], open: "09:00", close: "19:00" }],
  instagram: "mercankuyumculuk80",
  email: "mercankuyumculukosmaniye@gmail.com",
};

export async function loadConfig() {
  try {
    const res = await fetch("/api/config", { cache: "no-cache" });
    if (!res.ok) throw new Error(String(res.status));
    const doc = await res.json();
    const store = { ...DEFAULT_STORE, ...(doc.store || {}) };
    if (!store.instagram) store.instagram = DEFAULT_STORE.instagram;
    return { ...doc, products: doc.products || {}, store };
  } catch {
    return { store: DEFAULT_STORE, products: {}, feed: { url: DEFAULT_FEED, enabled: true } };
  }
}

let catalogPromise = null;
/** Product names, groups and decimals (same list as Catalog.kt). Returns a Map code -> product. */
export function loadCatalog() {
  catalogPromise ??= fetch("/catalog.json")
    .then((r) => r.json())
    .then((c) => new Map(c.products.map((p) => [p.code, p])))
    .catch(() => new Map());
  return catalogPromise;
}

/** "Çeyrek Altın" — old coins carry no label, new ones "(Yeni)", as in Catalog.fullName(). */
export function productName(p) {
  if (!p) return "";
  return p.variant && p.variant !== "Eski" ? `${p.name} (${p.variant})` : p.name;
}

function num(v) {
  const n = typeof v === "string" ? Number(v.trim().replace(",", ".")) : v;
  return Number.isFinite(n) && n > 0 ? n : null;
}

function adjust(value, adj, percent) {
  if (value == null) return null;
  const out = percent ? value * (1 + adj / 100) : value + adj;
  return out > 0 ? out : null;
}

function changePct(current, close) {
  return current != null && close != null && close > 0 ? ((current - close) / close) * 100 : null;
}

/** Applies the jeweler's override to a raw quote; null means "do not show". Mirrors PricingEngine.price. */
export function price(raw, o = {}) {
  if (o.visible === false) return null;
  if (o.mode === "fixed") {
    const buy = o.buy > 0 ? o.buy : null;
    const sell = o.sell > 0 ? o.sell : null;
    if (buy != null || sell != null) {
      return { buy, sell, changePct: null, low: null, high: null, source: "fixed", time: null };
    }
  }
  if (!raw || (raw.buy == null && raw.sell == null)) return null;
  if (o.mode === "adjust" && (o.buyAdj || o.sellAdj)) {
    const pct = o.adjUnit === "percent";
    const sa = o.sellAdj || 0;
    const sell = adjust(raw.sell, sa, pct);
    return {
      buy: adjust(raw.buy, o.buyAdj || 0, pct),
      sell,
      changePct: changePct(sell, adjust(raw.close, sa, pct)),
      low: adjust(raw.low, sa, pct),
      high: adjust(raw.high, sa, pct),
      source: "adjusted",
      time: raw.time,
    };
  }
  return {
    buy: raw.buy, sell: raw.sell, changePct: changePct(raw.sell, raw.close),
    low: raw.low, high: raw.high, source: "live", time: raw.time,
  };
}

/**
 * Starts the live feed. [onUpdate] receives a Map code -> quote with overrides applied, plus
 * `buyTick`/`sellTick` ("up" | "down" | "") and `changed` (true when this update moved the price).
 * [onStatus] receives "connecting" | "live" | "offline".
 */
export function startLive({ config, onUpdate, onStatus = () => {} }) {
  const raw = {};
  const overrides = config.products || {};
  const feedOn = config.feed?.enabled !== false;
  const last = new Map();
  let socket = null;
  let retry = 0;
  let stopped = false;
  let lastTime = null;

  const dir = (a, b) => (a == null || b == null || a === b ? "" : b > a ? "up" : "down");

  const emit = () => {
    const out = new Map();
    const codes = new Set([...Object.keys(raw), ...Object.keys(overrides)]);
    for (const code of codes) {
      const q = price(feedOn ? raw[code] : null, overrides[code]);
      if (!q) continue;
      const prev = last.get(code);
      const bt = prev ? dir(prev.buy, q.buy) : "";
      const st = prev ? dir(prev.sell, q.sell) : "";
      q.changed = !!(bt || st);
      q.buyTick = bt || prev?.buyTick || "";
      q.sellTick = st || prev?.sellTick || "";
      last.set(code, q);
      out.set(code, q);
    }
    onUpdate(out, lastTime);
  };

  const connect = () => {
    if (stopped || !feedOn) return;
    onStatus("connecting");
    const base = (config.feed?.url || DEFAULT_FEED).trim().replace(/^https:/, "wss:").replace(/\/$/, "");
    const url = base.includes("/socket.io/") ? base : `${base}/socket.io/?EIO=4&transport=websocket`;
    try {
      socket = new WebSocket(url);
    } catch {
      socket = null;
      setTimeout(connect, 5000);
      return;
    }
    socket.onmessage = (e) => {
      const d = String(e.data);
      if (d[0] === "0") socket.send("40");
      else if (d === "2") socket.send("3");
      else if (d.startsWith("42")) {
        let name, payload;
        try { [name, payload] = JSON.parse(d.slice(2).replace(/^\d+/, "")); } catch { return; }
        if (name !== "price_changed" || !payload) return;
        retry = 0;
        for (const [key, q] of Object.entries(payload.data || {})) {
          const code = (q && q.code) || key;
          raw[code] = {
            buy: num(q.alis), sell: num(q.satis), close: num(q.kapanis),
            low: num(q.dusuk), high: num(q.yuksek), time: q.tarih || null,
          };
          if (q.tarih) lastTime = q.tarih;
        }
        onStatus("live");
        emit();
      }
    };
    socket.onclose = () => {
      socket = null;
      if (stopped) return;
      onStatus("offline");
      setTimeout(connect, Math.min(30000, 1000 * 2 ** retry++));
    };
  };

  emit(); // fixed prices show even before the feed answers
  if (!feedOn) onStatus("live");
  connect();

  // Browsers throttle hidden tabs; reconnect promptly when the page is shown again.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && !socket && !stopped) { retry = 0; connect(); }
  });
  return () => { stopped = true; socket?.close(); };
}

// ---------- formatting ----------

export function fmt(value, decimals = 0) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("tr-TR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function fmtPct(p) {
  if (p == null || !Number.isFinite(p)) return "";
  return `%${Math.abs(p).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Decimals used on the site: gold per gram keeps 2, coins none, currencies 2 (enough for shoppers). */
export function siteDecimals(p) {
  if (!p) return 2;
  if (p.group === "CURRENCY") return 2;
  return p.decimals;
}

export function esc(text) {
  return String(text ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// ---------- store ----------

export function phoneHref(n) { return "tel:" + String(n).replace(/[^\d+]/g, ""); }

export function whatsappHref(n, text) {
  let d = String(n).replace(/\D/g, "");
  if (d.startsWith("0")) d = "9" + d;
  else if (d.length === 10 && d.startsWith("5")) d = "90" + d;
  return `https://wa.me/${d}` + (text ? `?text=${encodeURIComponent(text)}` : "");
}

export function formatPhone(n) {
  const d = String(n).replace(/\D/g, "").replace(/^90/, "0");
  const m = d.match(/^(0\d{3})(\d{3})(\d{2})(\d{2})$/);
  return m ? `${m[1]} ${m[2]} ${m[3]} ${m[4]}` : n;
}

export function mapsHref(s) {
  return s.lat != null && s.lng != null
    ? `https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.mapsQuery || s.name)}`;
}

export function mapsEmbed(s) {
  const q = s.lat != null && s.lng != null ? `${s.lat},${s.lng}` : (s.mapsQuery || s.name);
  return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=16&output=embed`;
}

export function instagramHref(handle) {
  return `https://www.instagram.com/${String(handle).replace(/^@/, "")}/`;
}

/** Current time in Istanbul (UTC+3, no DST) as {day 1=Mon..7=Sun, minutes}. */
export function istanbulNow(date = new Date()) {
  const t = new Date(date.getTime() + 3 * 3600_000);
  const wd = t.getUTCDay();
  return { day: wd === 0 ? 7 : wd, minutes: t.getUTCHours() * 60 + t.getUTCMinutes(), date: t };
}

const toMin = (hhmm) => { const [h, m] = String(hhmm).split(":").map(Number); return h * 60 + m; };

/** {open: bool, text} for the "Şu an açık" badge, from store.openingHours. Null when unknown. */
export function openState(store, date = new Date()) {
  const rows = store.openingHours || [];
  if (!rows.length) return null;
  const { day, minutes } = istanbulNow(date);
  for (const r of rows) {
    if (r.days?.includes(day) && minutes >= toMin(r.open) && minutes < toMin(r.close)) {
      return { open: true, text: `Şu an açık · ${r.close}’a kadar` };
    }
  }
  // Next opening within a week.
  for (let i = 0; i < 8; i++) {
    const d = ((day - 1 + i) % 7) + 1;
    const candidates = rows.filter((r) => r.days?.includes(d)).map((r) => r.open).sort();
    for (const o of candidates) {
      if (i === 0 && toMin(o) <= minutes) continue;
      const when = i === 0 ? "bugün" : i === 1 ? "yarın" : DAY_LONG[d - 1];
      return { open: false, text: `Şu an kapalı · ${when} ${o}’da açılır` };
    }
  }
  return { open: false, text: "Şu an kapalı" };
}

export const DAY_LONG = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
export const DAY_SHORT = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

/** Fills elements carrying [data-store] attributes from the configuration. */
export function fillStore(store) {
  for (const el of document.querySelectorAll("[data-store]")) {
    const k = el.dataset.store;
    if (k === "phone") { el.textContent = formatPhone(store.phone); if (el.tagName === "A") el.href = phoneHref(store.phone); }
    else if (k === "phone-href") el.href = phoneHref(store.phone);
    else if (k === "whatsapp-href") el.href = whatsappHref(store.whatsapp || store.phone, "Merhaba, bilgi almak istiyorum.");
    else if (k === "maps-href") el.href = mapsHref(store);
    else if (k === "email-href") { if (store.email) el.href = `mailto:${store.email}`; else el.hidden = true; }
    else if (k === "instagram-href") { if (store.instagram) el.href = instagramHref(store.instagram); else el.hidden = true; }
    else if (k === "instagram") { if (store.instagram) el.textContent = "@" + String(store.instagram).replace(/^@/, ""); else el.hidden = true; }
    else if (store[k]) el.textContent = store[k];
  }
}
