import { DAY_LONG, esc, fmt, fmtPct, istanbulNow, loadCatalog, loadConfig, mapsEmbed, openState, productName, siteDecimals, startLive } from "./live.js";
import { siteContent, iconFor, iconSvg } from "./site-defaults.js";
import { arrowIcon, flash, initChrome, reveal, setLiveDot, updateTicker } from "./chrome.js";
import { createBoard } from "./board.js";

const [config, catalog] = await Promise.all([loadConfig(), loadCatalog()]);
const site = siteContent(config);
initChrome({ config, site, current: "home" });

// ---------- texts ----------
for (const el of document.querySelectorAll("[data-site]")) {
  const v = el.dataset.site.split(".").reduce((o, k) => o?.[k], site);
  el.textContent = v || "";
}
if (!site.about.quote) document.querySelector("[data-quote]").hidden = true;

// Headline: each line slides up; the last word is gold and italic.
(() => {
  const words = site.hero.title.trim().split(/\s+/);
  const last = words.pop();
  const lines = [];
  const first = words.join(" ");
  if (first) {
    const half = first.split(" ");
    if (half.length > 3) {
      const mid = Math.ceil(half.length / 2);
      lines.push(half.slice(0, mid).join(" "), half.slice(mid).join(" "));
    } else lines.push(first);
  }
  const h = document.querySelector("[data-hero-title]");
  h.innerHTML = lines.map((l) => `<span class="split-line"><span>${esc(l)}</span></span>`).join("") +
    `<span class="split-line"><span><em class="gold-text">${esc(last)}</em></span></span>`;
})();

// ---------- categories ----------
(() => {
  const cats = site.categories.filter((c) => c.visible !== false);
  const counts = new Map();
  for (const p of site.items) if (p.visible !== false) counts.set(p.categoryId, (counts.get(p.categoryId) || 0) + 1);
  const root = document.querySelector("[data-cats]");
  root.innerHTML = cats.slice(0, 11).map((c, i) => {
    const n = counts.get(c.id) || 0;
    const art = c.image
      ? `<div class="art photo"><img src="/api/media/${esc(c.image)}" alt="" loading="lazy"></div>`
      : `<div class="art">${iconSvg(iconFor(c))}</div>`;
    return `<a class="cat reveal ${i === 0 ? "big" : ""}" href="/koleksiyon/?k=${encodeURIComponent(c.id)}" style="transition-delay:${(i % 4) * 70}ms">
      ${art}<span class="go">${arrowIcon()}</span>${n ? `<span class="count">${n} MODEL</span>` : ""}
      <h3>${esc(c.title)}</h3><p>${esc(c.subtitle)}</p></a>`;
  }).join("");
  // Spotlight follows the pointer; a slight tilt adds depth.
  for (const card of root.querySelectorAll(".cat")) {
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      card.style.setProperty("--mx", `${x * 100}%`);
      card.style.setProperty("--my", `${y * 100}%`);
      card.style.transform = `perspective(900px) rotateX(${(0.5 - y) * 5}deg) rotateY(${(x - 0.5) * 7}deg)`;
    });
    card.addEventListener("pointerleave", () => { card.style.transform = ""; });
  }
  const words = cats.map((c) => `<span>${esc(c.title)}</span>`).join("");
  document.querySelector("[data-words]").innerHTML = words + words;
})();

// ---------- store ----------
(() => {
  const s = config.store;
  const hours = document.querySelector("[data-hours]");
  const today = istanbulNow().day;
  const rows = [];
  for (let d = 1; d <= 7; d++) {
    const ranges = (s.openingHours || []).filter((h) => h.days?.includes(d)).map((h) => `${h.open} – ${h.close}`);
    rows.push(`<span class="${d === today ? "today" : ""}">${DAY_LONG[d - 1]}</span><span class="${d === today ? "today" : ""}">${ranges.join(", ") || "Kapalı"}</span>`);
  }
  hours.innerHTML = (s.openingHours || []).length ? rows.join("") : `<span>${esc(s.hoursText)}</span>`;
  const st = openState(s);
  const pill = document.querySelector("[data-open-pill]");
  if (st) {
    document.querySelector("[data-open-text]").textContent = st.text;
    pill.classList.toggle("closed", !st.open);
    document.querySelector("[data-store-open]").textContent = st.open ? "Açık" : "Kapalı";
    document.querySelector("[data-store-open-text]").textContent = st.text.split("·")[1]?.trim() || "Mağaza";
  } else pill.hidden = true;
  // The map loads only when it scrolls near, to keep the first paint fast.
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
  const CODES = ["ALTIN", "AYAR22", "AYAR14", "KULCEALTIN", "CEYREK_YENI", "CEYREK_ESKI", "YARIM_YENI", "TEK_YENI", "ATA_YENI", "GUMUSTRY", "USDTRY", "EURTRY"];
  const sel = document.querySelector("[data-calc-product]");
  const amount = document.querySelector("[data-calc-amount]");
  const out = document.querySelector("[data-calc-result]");
  const note = document.querySelector("[data-calc-note]");
  let side = "buy";
  let quotes = new Map();
  sel.innerHTML = CODES.map((c) => catalog.get(c)).filter(Boolean)
    .map((p) => `<option value="${p.code}">${esc(productName(p))}</option>`).join("");
  sel.value = "AYAR22";
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
const board = createBoard(document.querySelector("[data-board]"), catalog, { limit: 7, groups: [["GOLD", "Altın"], ["COINS", "Sarrafiye"], ["CURRENCY", "Döviz"], ["METALS", "Emtia"]] });
const statusEl = document.querySelector("[data-status]");
const updatedEl = document.querySelector("[data-updated]");

startLive({
  config,
  onStatus(s) {
    setLiveDot(s);
    statusEl.textContent = s === "live" ? "Canlı" : s === "offline" ? "Bağlantı bekleniyor" : "Bağlanıyor…";
  },
  onUpdate(quotes) {
    updateTicker(quotes, catalog);
    board.update(quotes);
    calc.update(quotes);
    for (const card of document.querySelectorAll("[data-card]")) {
      const q = quotes.get(card.dataset.card);
      if (!q) continue;
      const d = siteDecimals(catalog.get(card.dataset.card));
      const s = card.querySelector("[data-s]");
      const t = `${fmt(q.sell, d)} ₺`;
      if (s.textContent !== t) { const had = s.textContent !== "—"; s.textContent = t; if (had && q.changed) flash(s, q.sellTick); }
      card.querySelector("[data-b]").textContent = `${fmt(q.buy, d)} ₺`;
      const c = card.querySelector("[data-c]");
      c.className = q.changePct == null ? "" : q.changePct >= 0 ? "up" : "down";
      c.textContent = q.changePct == null ? "" : `${q.changePct >= 0 ? "▲" : "▼"} ${fmtPct(q.changePct)}`;
    }
    const has = quotes.get("ALTIN");
    if (has) document.querySelector("[data-hero-has]").textContent = `${fmt(has.sell, 2)} ₺`;
    for (const el of document.querySelectorAll("[data-mini]")) {
      const q = quotes.get(el.dataset.mini);
      if (q) el.textContent = fmt(q.sell, siteDecimals(catalog.get(el.dataset.mini)));
    }
    const { date } = istanbulNow();
    updatedEl.textContent = `Son güncelleme ${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}:${String(date.getUTCSeconds()).padStart(2, "0")}`;
  },
});

reveal();
goldDust(document.querySelector("canvas.dust"));

/** Slowly rising gold sparks behind the hero. */
function goldDust(canvas) {
  if (!canvas || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const g = canvas.getContext("2d");
  let w = 0, h = 0, parts = [], running = true;
  const dpr = Math.min(2, devicePixelRatio || 1);
  const resize = () => {
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(Math.min(90, (w * h) / 14000));
    parts = Array.from({ length: n }, () => spawn(true));
  };
  const spawn = (any) => ({
    x: Math.random() * w, y: any ? Math.random() * h : h + 10,
    r: Math.random() * 1.6 + 0.4, v: Math.random() * 0.35 + 0.12, a: Math.random() * Math.PI * 2, s: Math.random() * 0.02 + 0.005,
  });
  const step = () => {
    if (!running) return;
    g.clearRect(0, 0, w, h);
    for (const p of parts) {
      p.y -= p.v; p.a += p.s; p.x += Math.sin(p.a) * 0.3;
      if (p.y < -10) Object.assign(p, spawn(false));
      const alpha = 0.25 + 0.55 * Math.abs(Math.sin(p.a * 2));
      g.beginPath();
      g.fillStyle = `rgba(246, 214, 120, ${alpha})`;
      g.shadowColor = "rgba(246, 214, 120, .8)";
      g.shadowBlur = 8;
      g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      g.fill();
    }
    requestAnimationFrame(step);
  };
  resize();
  addEventListener("resize", resize);
  new IntersectionObserver(([e]) => { const was = running; running = e.isIntersecting; if (running && !was) step(); }).observe(canvas);
  step();
}
