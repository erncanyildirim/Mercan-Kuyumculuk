// Admin panel for the jeweler: edits the document served at /api/config.
// Pricing math mirrors PricingEngine in shared/.../data/market/Pricing.kt.

const TOKEN_KEY = "mercan.admin.token";
const DAY_NAMES = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

// Same defaults as RemoteConfig.kt, used until the first save.
const DEFAULTS = {
  schema: 1,
  version: 0,
  feed: { url: "wss://hrmsocketonly.haremaltin.com", enabled: true },
  store: {
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
    instagram: "",
    email: "mercankuyumculukosmaniye@gmail.com",
    website: "",
  },
  announcement: { enabled: false, text: "", style: "info" },
  products: {},
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

let token = sessionStorage.getItem(TOKEN_KEY);
let catalog = [];
let config = structuredClone(DEFAULTS);
let saved = "";
const live = {};
const view = { group: "", query: "", onlyChanged: false };

// ---------- formatting ----------

function fmt(value, decimals) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString("tr-TR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function parseNum(text) {
  if (text === null || text === undefined) return null;
  let s = String(text).trim().replace(/\s|₺/g, "");
  if (!s) return null;
  // Same rules as TrFormat.parseInput: "10.900" and "1.234,50" use Turkish thousands dots.
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, "");
  else if (/^-?\d+\.\d{3}$/.test(s)) s = s.replace(".", "");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function adjust(value, adj, percent) {
  if (value === null || value === undefined) return null;
  const out = percent ? value * (1 + adj / 100) : value + adj;
  return out > 0 ? out : null;
}

function priced(code) {
  const o = config.products[code] ?? {};
  const r = live[code];
  // The feed lists inactive codes without prices; the app hides those (PricingEngine).
  const raw = r && (r.buy !== null || r.sell !== null) ? r : null;
  if (o.visible === false) return null;
  if (o.mode === "fixed" && (o.buy || o.sell)) return { buy: o.buy || null, sell: o.sell || null };
  if (!raw) return null;
  if (o.mode === "adjust") {
    const pct = o.adjUnit === "percent";
    return { buy: adjust(raw.buy, o.buyAdj || 0, pct), sell: adjust(raw.sell, o.sellAdj || 0, pct) };
  }
  return { buy: raw.buy, sell: raw.sell };
}

/** Config without no-op product entries, used to decide whether anything changed. */
function normalized(c) {
  const products = {};
  for (const [code, o] of Object.entries(c.products)) {
    const noop = (o.mode ?? "live") === "live" && o.visible !== false;
    if (!noop) products[code] = o;
  }
  return JSON.stringify({ ...c, products });
}

// ---------- api ----------

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, { ...options, headers });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (res.status === 401 && path !== "/api/admin/login") {
    showLogin("Oturum süresi doldu, tekrar giriş yapın.");
    throw new Error("unauthorized");
  }
  if (!res.ok) throw new Error(body?.error || `Sunucu hatası (${res.status})`);
  return body;
}

// ---------- views ----------

function showLogin(message = "") {
  token = null;
  sessionStorage.removeItem(TOKEN_KEY);
  // Unsaved edits stay in memory and are shown again after logging back in.
  $("#editor-view").hidden = true;
  $("#logout").hidden = true;
  $("#login-view").hidden = false;
  $("#login-error").textContent = message;
  $("#password").focus();
}

async function showEditor() {
  $("#login-view").hidden = true;
  $("#editor-view").hidden = false;
  $("#logout").hidden = false;
  const [cat, doc] = await Promise.all([
    fetch("../catalog.json").then((r) => r.json()),
    api("/api/admin/config"),
  ]);
  catalog = cat.products;
  config = merge(structuredClone(DEFAULTS), doc);
  saved = normalized(config);
  renderGroupChips();
  renderProducts();
  renderFields();
  renderHours();
  updateDirty();
  connectFeed();
}

function merge(base, doc) {
  if (!doc || typeof doc !== "object") return base;
  return {
    ...base,
    ...doc,
    feed: { ...base.feed, ...(doc.feed || {}) },
    store: { ...base.store, ...(doc.store || {}) },
    announcement: { ...base.announcement, ...(doc.announcement || {}) },
    products: { ...(doc.products || {}) },
  };
}

function renderGroupChips() {
  const root = $("#group-chips");
  const groups = [["", "Tümü"], ...new Map(catalog.map((p) => [p.group, p.groupTitle])).entries()];
  root.innerHTML = "";
  for (const [g, title] of groups) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = title;
    b.setAttribute("aria-pressed", String(view.group === g));
    b.addEventListener("click", () => {
      view.group = g;
      for (const x of $$("button", root)) x.setAttribute("aria-pressed", String(x === b));
      renderProducts();
    });
    root.append(b);
  }
}

function productLabel(p) {
  return p.variant ? `${p.name} <small>${p.variant}</small>` : p.name;
}

/** Lowercase without Turkish accents, so "ceyrek" finds "Çeyrek". */
function fold(text) {
  return String(text ?? "").toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i").replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u");
}

function isCustom(o) {
  return !!o && ((o.mode ?? "live") !== "live" || o.visible === false);
}

function renderProducts() {
  const query = fold(view.query.trim());
  const root = $("#products");
  root.innerHTML = "";
  let lastGroup = null;
  let shown = 0;
  for (const p of catalog) {
    if (view.group && p.group !== view.group) continue;
    if (view.onlyChanged && !isCustom(config.products[p.code])) continue;
    if (query && !fold(`${p.name} ${p.variant ?? ""} ${p.groupTitle} ${p.code}`).includes(query)) continue;
    shown++;
    if (p.group !== lastGroup) {
      lastGroup = p.group;
      const h = document.createElement("div");
      h.className = "group-title";
      h.textContent = p.groupTitle;
      root.append(h);
    }
    root.append(productCard(p));
  }
  const empty = $("#no-results");
  empty.hidden = shown > 0;
  empty.textContent = view.onlyChanged && !query
    ? "Özel fiyat girilmiş ürün yok. Tüm ürünler Harem Altın'ın canlı fiyatıyla gösteriliyor."
    : "Aramanıza uygun ürün yok.";
}

function productCard(p) {
  const o = config.products[p.code] ?? {};
  const mode = o.mode ?? "live";
  const card = document.createElement("div");
  card.className = "product";
  card.dataset.code = p.code;
  card.innerHTML = `
    <div class="head">
      <div class="name">${productLabel(p)}<span data-badge></span><span class="live" data-live></span></div>
      <div class="seg" role="group" aria-label="${p.name} fiyat türü">
        <button type="button" data-mode="live">Canlı</button>
        <button type="button" data-mode="adjust">Fark ekle</button>
        <button type="button" data-mode="fixed">Sabit fiyat</button>
      </div>
      <label class="check"><input type="checkbox" data-visible> Göster</label>
    </div>
    <div class="body" data-body></div>
    <div class="result muted" data-result></div>`;
  for (const b of $$("[data-mode]", card)) {
    b.setAttribute("aria-pressed", String(b.dataset.mode === mode));
    b.addEventListener("click", () => {
      setProduct(p.code, { mode: b.dataset.mode });
      replaceCard(p);
    });
  }
  const visible = $("[data-visible]", card);
  visible.checked = o.visible !== false;
  visible.addEventListener("change", () => {
    setProduct(p.code, { visible: visible.checked });
    replaceCard(p);
  });

  const body = $("[data-body]", card);
  if (mode === "adjust") {
    body.innerHTML = `
      <label>Alışa ekle <input data-k="buyAdj" inputmode="text" placeholder="örn. -38"></label>
      <label>Satışa ekle <input data-k="sellAdj" inputmode="text" placeholder="örn. 50"></label>
      <label>Birim <select data-k="adjUnit"><option value="amount">TL</option><option value="percent">Yüzde (%)</option></select></label>`;
    $("[data-k=buyAdj]", body).value = o.buyAdj ? String(o.buyAdj).replace(".", ",") : "";
    $("[data-k=sellAdj]", body).value = o.sellAdj ? String(o.sellAdj).replace(".", ",") : "";
    $("[data-k=adjUnit]", body).value = o.adjUnit ?? "amount";
  } else if (mode === "fixed") {
    body.innerHTML = `
      <label>Alış fiyatı <input data-k="buy" inputmode="decimal"></label>
      <label>Satış fiyatı <input data-k="sell" inputmode="decimal"></label>
      <p class="muted">Boş bırakılan fiyat uygulamada “—” olarak görünür.</p>`;
    $("[data-k=buy]", body).value = o.buy ? String(o.buy).replace(".", ",") : "";
    $("[data-k=sell]", body).value = o.sell ? String(o.sell).replace(".", ",") : "";
  }
  for (const input of $$("[data-k]", body)) {
    input.addEventListener("input", () => {
      const k = input.dataset.k;
      const v = k === "adjUnit" ? input.value : parseNum(input.value);
      input.setCustomValidity(Number.isNaN(v) ? "Geçerli bir sayı girin, örn. 10.900 veya 1.234,50" : "");
      if (Number.isNaN(v)) input.reportValidity();
      if (!Number.isNaN(v)) setProduct(p.code, { [k]: k === "adjUnit" ? v : v ?? (k.endsWith("Adj") ? 0 : null) });
      updateCard(card, p);
      updateDirty();
    });
  }
  updateCard(card, p);
  return card;
}

function replaceCard(p) {
  const old = $(`.product[data-code="${p.code}"]`);
  if (old) old.replaceWith(productCard(p));
}

function setProduct(code, patch) {
  const current = config.products[code] ?? { mode: "live", visible: true, buyAdj: 0, sellAdj: 0, adjUnit: "amount" };
  config.products[code] = { ...current, ...patch };
  updateDirty();
}

function updateCard(card, p) {
  const raw = live[p.code];
  const hasRaw = raw && (raw.buy !== null || raw.sell !== null);
  $("[data-live]", card).innerHTML = hasRaw
    ? `Harem canlı: alış <b>${fmt(raw.buy, p.decimals)}</b> · satış <b>${fmt(raw.sell, p.decimals)}</b>`
    : "Harem canlı: —";
  const o = config.products[p.code];
  const mode = o?.mode ?? "live";
  $("[data-badge]", card).innerHTML = o?.visible === false
    ? '<span class="badge gray">Gizli</span>'
    : mode === "adjust" ? '<span class="badge">Fark</span>' : mode === "fixed" ? '<span class="badge">Sabit</span>' : "";
  const result = $("[data-result]", card);
  if (o?.visible === false) {
    result.innerHTML = "<span>Bu ürün uygulamada <b>gösterilmiyor</b></span>";
  } else {
    const q = priced(p.code);
    const diff = (v, base) => {
      if (!hasRaw || mode === "live" || v === null || base === null) return "";
      const d = v - base;
      if (Math.abs(d) < 10 ** -p.decimals / 2) return "";
      return ` <span class="diff ${d > 0 ? "up" : "down"}">${d > 0 ? "+" : "−"}${fmt(Math.abs(d), p.decimals)}</span>`;
    };
    result.innerHTML = q
      ? `<span>Uygulamada alış <b>${fmt(q.buy, p.decimals)}</b>${diff(q.buy, raw?.buy ?? null)}</span>` +
        `<span>satış <b>${fmt(q.sell, p.decimals)}</b>${diff(q.sell, raw?.sell ?? null)}</span>` +
        `<span>${p.currency}</span>`
      : "<span>Uygulamada fiyat yok (canlı veri bekleniyor)</span>";
  }
  card.classList.toggle("hidden-product", o?.visible === false);
  card.classList.toggle("changed", isCustom(o));
}

// ---------- simple fields ----------

function getPath(path) {
  return path.split(".").reduce((o, k) => o?.[k], config);
}

function setPath(path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  keys.reduce((o, k) => o[k], config)[last] = value;
}

function renderFields() {
  for (const el of $$("[data-field]")) {
    const value = getPath(el.dataset.field);
    if (el.type === "checkbox") el.checked = !!value;
    else el.value = value ?? "";
    el.oninput = el.onchange = () => {
      let v = el.type === "checkbox" ? el.checked : el.value;
      if (el.dataset.field === "store.lat" || el.dataset.field === "store.lng") {
        // Google Maps copies "37.0742, 36.2478": split it into both fields.
        const pair = String(v).match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
        if (pair) {
          config.store.lat = Number(pair[1]);
          config.store.lng = Number(pair[2]);
          $('[data-field="store.lat"]').value = pair[1];
          $('[data-field="store.lng"]').value = pair[2];
          updateDirty();
          return;
        }
        const t = String(v).trim().replace(",", ".");
        const n = t === "" ? null : Number(t);
        el.setCustomValidity(n !== null && !Number.isFinite(n) ? "Örn. 37.0742" : "");
        v = n !== null && Number.isFinite(n) ? n : null;
      }
      setPath(el.dataset.field, v);
      updateDirty();
    };
  }
}

function renderHours() {
  const root = $("#hours");
  root.innerHTML = "";
  config.store.openingHours.forEach((h, i) => {
    const row = document.createElement("div");
    row.className = "hours-row";
    row.innerHTML = `
      <div class="days">${DAY_NAMES.map((d, j) =>
        `<label><input type="checkbox" value="${j + 1}" ${h.days.includes(j + 1) ? "checked" : ""}><span>${d}</span></label>`).join("")}</div>
      <input type="time" value="${h.open}" aria-label="Açılış">
      <input type="time" value="${h.close}" aria-label="Kapanış">
      <button type="button" class="ghost small" aria-label="Satırı sil">Sil</button>`;
    for (const cb of $$(".days input", row)) {
      cb.addEventListener("change", () => {
        h.days = $$(".days input", row).filter((x) => x.checked).map((x) => Number(x.value));
        updateDirty();
      });
    }
    const [open, close] = $$("input[type=time]", row);
    open.addEventListener("input", () => { h.open = open.value; updateDirty(); });
    close.addEventListener("input", () => { h.close = close.value; updateDirty(); });
    $("button", row).addEventListener("click", () => {
      config.store.openingHours.splice(i, 1);
      renderHours();
      updateDirty();
    });
    root.append(row);
  });
}

// ---------- save ----------

function updateDirty() {
  const dirty = normalized(config) !== saved;
  const invalid = $$("#editor-view input:invalid").length > 0;
  $("#save").disabled = !dirty || invalid || saving;
  $("#discard").disabled = !dirty || saving;
  $(".savebar").classList.toggle("dirty", dirty);
  const custom = Object.values(config.products).filter(isCustom).length;
  $("#override-count").textContent = custom
    ? `${custom} üründe özel fiyat veya gizleme var`
    : "Tüm ürünler canlı fiyatla gösteriliyor";
  if (invalid) {
    $("#save-status").textContent = "Hatalı alanları düzeltin (kırmızı çerçeveli)";
    return;
  }
  if (dirty) $("#save-status").textContent = "Kaydedilmemiş değişiklikler var";
  else if (!$("#save-status").dataset.keep) $("#save-status").textContent = "";
}

let saving = false;

async function save() {
  const button = $("#save");
  saving = true;
  button.disabled = true;
  $("#save-status").textContent = "Kaydediliyor…";
  const sent = normalized(config);
  try {
    const doc = await api("/api/admin/config", { method: "PUT", body: JSON.stringify(config) });
    const fresh = merge(structuredClone(DEFAULTS), doc);
    saved = normalized(fresh);
    if (normalized(config) === sent) {
      config = fresh;
      renderProducts();
      renderFields();
      renderHours();
    } else {
      // Edits made while saving stay on screen and remain unsaved.
      config.version = fresh.version;
    }
    $("#save-status").dataset.keep = "1";
    $("#save-status").textContent = `Kaydedildi (sürüm ${doc.version})`;
    toast("Kaydedildi. Uygulamalar 2 dakika içinde güncellenir.");
    updateDirty();
    delete $("#save-status").dataset.keep;
  } catch (e) {
    if (e.message !== "unauthorized") $("#save-status").textContent = `Kaydedilemedi: ${e.message}`;
  } finally {
    saving = false;
    updateDirty();
  }
}

function discard() {
  if (!confirm("Kaydedilmemiş değişiklikler silinsin ve son kaydedilen hâle dönülsün mü?")) return;
  config = merge(structuredClone(DEFAULTS), JSON.parse(saved));
  renderProducts();
  renderFields();
  renderHours();
  for (const el of $$("#editor-view input")) el.setCustomValidity("");
  updateDirty();
  toast("Değişiklikler geri alındı");
}

let toastTimer = 0;
function toast(text) {
  const el = $("#toast");
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
}

// ---------- live feed (Socket.IO v4 over a plain WebSocket, see HaremProtocol.kt) ----------

let socket = null;
let retry = 0;

function setFeedStatus(text, cls) {
  const el = $("#feed-status");
  el.textContent = text;
  el.className = `pill ${cls || ""}`;
}

function numOrNull(v) {
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) && n > 0 ? n : null;
}

function connectFeed() {
  if (socket) return;
  const base = (config.feed.url || DEFAULTS.feed.url).replace(/^https:/, "wss:").replace(/\/$/, "");
  socket = new WebSocket(`${base}/socket.io/?EIO=4&transport=websocket`);
  socket.onmessage = (e) => {
    const d = String(e.data);
    if (d[0] === "0") socket.send("40");
    else if (d === "2") socket.send("3");
    else if (d.startsWith("42")) {
      const [name, payload] = JSON.parse(d.slice(2));
      if (name !== "price_changed") return;
      retry = 0;
      for (const [code, q] of Object.entries(payload.data || {})) {
        live[code] = { buy: numOrNull(q.alis), sell: numOrNull(q.satis) };
      }
      setFeedStatus("Canlı fiyatlar bağlı", "live");
      for (const card of $$(".product")) {
        const p = catalog.find((x) => x.code === card.dataset.code);
        if (p) updateCard(card, p);
      }
    }
  };
  socket.onclose = () => {
    socket = null;
    setFeedStatus("Canlı fiyatlara bağlanılamadı, yeniden deneniyor…", "off");
    setTimeout(connectFeed, Math.min(30000, 1000 * 2 ** retry++));
  };
}

// ---------- wiring ----------

$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#login-error").textContent = "";
  try {
    const { token: t } = await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ password: $("#password").value }),
    });
    token = t;
    sessionStorage.setItem(TOKEN_KEY, t);
    $("#password").value = "";
    if (catalog.length && normalized(config) !== saved) {
      // Session expired with unsaved edits: keep them instead of reloading.
      $("#login-view").hidden = true;
      $("#editor-view").hidden = false;
      $("#logout").hidden = false;
      updateDirty();
    } else {
      await showEditor();
    }
  } catch (err) {
    $("#login-error").textContent = err.message;
  }
});

$("#logout").addEventListener("click", () => showLogin());

// Theme switch: "system" follows the computer's light/dark setting.
const THEME_KEY = "mercan.admin.theme";
function applyTheme(choice) {
  if (choice === "light" || choice === "dark") document.documentElement.dataset.theme = choice;
  else delete document.documentElement.dataset.theme;
  for (const b of $$("[data-theme-choice]")) b.setAttribute("aria-pressed", String(b.dataset.themeChoice === choice));
}
let themeChoice = "system";
try { themeChoice = localStorage.getItem(THEME_KEY) || "system"; } catch {}
applyTheme(themeChoice);
for (const b of $$("[data-theme-choice]")) {
  b.addEventListener("click", () => {
    applyTheme(b.dataset.themeChoice);
    try { localStorage.setItem(THEME_KEY, b.dataset.themeChoice); } catch {}
  });
}
$("#save").addEventListener("click", save);
$("#discard").addEventListener("click", discard);
$("#product-search").addEventListener("input", (e) => { view.query = e.target.value; renderProducts(); });
$("#only-changed").addEventListener("change", (e) => { view.onlyChanged = e.target.checked; renderProducts(); });
$("#toggle-pw").addEventListener("click", () => {
  const input = $("#password");
  const show = input.type === "password";
  input.type = show ? "text" : "password";
  $("#toggle-pw").textContent = show ? "Gizle" : "Göster";
  $("#toggle-pw").setAttribute("aria-label", show ? "Şifreyi gizle" : "Şifreyi göster");
  input.focus();
});
$("#add-hours").addEventListener("click", () => {
  config.store.openingHours.push({ days: [6], open: "10:00", close: "17:00" });
  renderHours();
  updateDirty();
});

for (const tab of $$("[role=tab]")) {
  tab.addEventListener("click", () => {
    for (const t of $$("[role=tab]")) t.setAttribute("aria-selected", String(t === tab));
    for (const panel of $$("[data-panel]")) panel.hidden = panel.dataset.panel !== tab.dataset.tab;
  });
}

window.addEventListener("beforeunload", (e) => {
  if (!$("#save").disabled) e.preventDefault();
});

if (token) showEditor().catch(() => showLogin());
else showLogin();
