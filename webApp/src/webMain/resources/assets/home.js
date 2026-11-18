import { DAY_LONG, esc, fmt, istanbulNow, loadCatalog, loadConfig, mapsEmbed, openState, productName, siteDecimals, startLive } from "./live.js?v=202611182247";
import { siteContent, iconFor, iconSvg } from "./site-defaults.js?v=202611182247";
import { arrowIcon, flash, initChrome, reveal } from "./chrome.js?v=202611182247";
import { createBoard } from "./board.js?v=202611182247";
import { renderProducts } from "./products.js?v=202611182247";

const [config, catalog] = await Promise.all([loadConfig(), loadCatalog()]);
const site = siteContent(config);
initChrome({ config, site, current: "home" });

// ---------- texts ----------
for (const el of document.querySelectorAll("[data-site]")) {
  el.textContent = el.dataset.site.split(".").reduce((o, k) => o?.[k], site) || "";
}
if (!site.about.quote) document.querySelector("[data-quote]").hidden = true;
(() => {
  // The last word of the headline is gold and italic.
  const words = site.hero.title.trim().split(/\s+/);
  const last = words.pop();
  document.querySelector("[data-hero-title]").innerHTML = `${esc(words.join(" "))} <em class="gold">${esc(last)}</em>`;
})();

// ---------- categories ----------
const cats = site.categories.filter((c) => c.visible !== false);
const items = site.items.filter((p) => p.visible !== false);
document.querySelector("[data-cats]").innerHTML = cats.slice(0, 8).map((c) => `
  <a class="cat reveal" href="/koleksiyon/?k=${encodeURIComponent(c.id)}">
    <div class="art">${c.image ? `<img src="/api/media/${esc(c.image)}" alt="" loading="lazy">` : iconSvg(iconFor(c))}</div>
    <div class="t"><div><h3>${esc(c.title)}</h3><p>${esc(c.subtitle)}</p></div><span class="go">${arrowIcon()}</span></div>
  </a>`).join("");

// ---------- featured products (with gram options) ----------
const featured = items.filter((p) => p.image || p.grams?.length).slice(0, 8);
let products = null;
if (featured.length) {
  document.querySelector("[data-featured-section]").hidden = false;
  products = renderProducts(document.querySelector("[data-featured]"), featured, cats, config.store);
}

// ---------- store ----------
(() => {
  const s = config.store;
  const today = istanbulNow().day;
  const rows = [];
  for (let d = 1; d <= 7; d++) {
    const ranges = (s.openingHours || []).filter((h) => h.days?.includes(d)).map((h) => `${h.open} – ${h.close}`);
    const cls = d === today ? ' class="today"' : "";
    rows.push(`<span${cls}>${DAY_LONG[d - 1]}</span><span${cls}>${ranges.join(", ") || "Kapalı"}</span>`);
  }
  document.querySelector("[data-hours]").innerHTML = (s.openingHours || []).length ? rows.join("") : `<span>${esc(s.hoursText)}</span>`;
  const st = openState(s);
  if (st) {
    document.querySelector("[data-open-text]").textContent = st.text;
    document.querySelector("[data-open-dot]").classList.toggle("closed", !st.open);
    document.querySelector("[data-store-open]").textContent = st.open ? "Şu an açığız" : "Şu an kapalıyız";
    document.querySelector("[data-store-open-text]").textContent = st.text.split("·")[1]?.trim() || s.hoursText;
  }
  const map = document.querySelector("[data-map]");
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    map.innerHTML = `<iframe title="Mağaza konumu" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="${mapsEmbed(s)}"></iframe>`;
  }, { rootMargin: "400px" });
  io.observe(map);
})();

// ---------- calculator ----------
const calc = (() => {
  const CODES = ["AYAR22", "ALTIN", "AYAR14", "KULCEALTIN", "CEYREK_YENI", "CEYREK_ESKI", "YARIM_YENI", "TEK_YENI", "ATA_YENI", "GUMUSTRY", "USDTRY", "EURTRY"];
  const sel = document.querySelector("[data-calc-product]");
  const amount = document.querySelector("[data-calc-amount]");
  const out = document.querySelector("[data-calc-result]");
  const note = document.querySelector("[data-calc-note]");
  let side = "buy";
  let quotes = new Map();
  sel.innerHTML = CODES.map((c) => catalog.get(c)).filter(Boolean).map((p) => `<option value="${p.code}">${esc(productName(p))}</option>`).join("");
  document.querySelector("[data-calc-side]").addEventListener("click", (e) => {
    const b = e.target.closest("[data-side]");
    if (!b) return;
    side = b.dataset.side;
    for (const x of b.parentElement.children) x.setAttribute("aria-selected", String(x === b));
    render();
  });
  sel.addEventListener("change", render);
  amount.addEventListener("input", render);
  function render() {
    const p = catalog.get(sel.value);
    const q = quotes.get(sel.value);
    const n = Number(String(amount.value).replace(",", "."));
    const unit = p?.group === "COINS" ? "adet" : p?.group === "CURRENCY" ? (p.unitHint || "birim") : "gram";
    const v = q?.[side];
    out.textContent = v != null && n > 0 ? `${fmt(v * n, 0)} ₺` : "—";
    note.textContent = v != null ? `${fmt(n || 0, n % 1 ? 2 : 0)} ${unit} × ${fmt(v, siteDecimals(p))} ₺` : "Fiyat bekleniyor";
  }
  return { update(q) { quotes = q; render(); } };
})();

// ---------- live ----------
const TODAY = [["ALTIN", "Has Altın", "24 ayar · gram"], ["AYAR22", "22 Ayar", "bilezik · gram"], ["KULCEALTIN", "Gram Altın", "külçe"], ["CEYREK_YENI", "Çeyrek Altın", "adet"]];
const todayEl = document.querySelector("[data-today]");
todayEl.innerHTML = TODAY.map(([c, n, h]) => `<div class="today-row" data-code="${c}"><span class="n">${n}<small>${h}</small></span><span class="b" data-b>—</span><span class="s" data-s>—</span></div>`).join("");
const board = createBoard(document.querySelector("[data-board]"), catalog, { limit: 7, groups: [["GOLD", "Altın"], ["COINS", "Sarrafiye"], ["CURRENCY", "Döviz"]] });
const updatedEl = document.querySelector("[data-updated]");

startLive({
  config,
  onStatus(s) {
    const pill = document.querySelector("[data-live]");
    pill.classList.toggle("off", s !== "live");
    document.querySelector("[data-live-text]").textContent = s === "live" ? "Canlı" : s === "offline" ? "Bağlantı bekleniyor" : "Bağlanıyor";
  },
  onUpdate(quotes) {
    board.update(quotes);
    calc.update(quotes);
    products?.update(quotes);
    for (const row of todayEl.children) {
      const q = quotes.get(row.dataset.code);
      if (!q) continue;
      const d = siteDecimals(catalog.get(row.dataset.code));
      const s = row.querySelector("[data-s]");
      const t = fmt(q.sell, d);
      if (s.textContent !== t) { const had = s.textContent !== "—"; s.textContent = t; if (had && q.changed) flash(s, q.sellTick); }
      row.querySelector("[data-b]").textContent = fmt(q.buy, d);
    }
    for (const el of document.querySelectorAll("[data-mini]")) {
      const q = quotes.get(el.dataset.mini);
      if (q) el.textContent = `${fmt(q.sell, siteDecimals(catalog.get(el.dataset.mini)))} ₺`;
    }
    const { date } = istanbulNow();
    updatedEl.textContent = `Son güncelleme ${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}:${String(date.getUTCSeconds()).padStart(2, "0")}`;
  },
});

reveal();
