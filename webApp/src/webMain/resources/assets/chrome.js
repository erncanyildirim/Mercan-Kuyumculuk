// Shared page chrome: live ticker, header with mega menu, bangle bar, mobile drawer, footer, WhatsApp button.
import { esc, fillStore, fmt, fmtPct, siteDecimals, whatsappHref } from "./live.js";
import { iconFor, iconSvg } from "./site-defaults.js";

const TICKER = [
  ["ALTIN", "HAS"], ["KULCEALTIN", "GRAM"], ["AYAR22", "22 AYAR"], ["AYAR14", "14 AYAR"],
  ["CEYREK_YENI", "ÇEYREK"], ["YARIM_YENI", "YARIM"], ["TEK_YENI", "TAM"], ["ATA_YENI", "ATA"],
  ["USDTRY", "USD"], ["EURTRY", "EUR"], ["GBPTRY", "GBP"], ["GUMUSTRY", "GÜMÜŞ"], ["ONS", "ONS"],
];

const I = {
  chevron: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2.5 4.5L6 8l3.5-3.5"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
  wa: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2m0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2m4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4a.5.5 0 0 0 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.4-.3"/></svg>',
};

export function arrowIcon() {
  return '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 8h10M9 4l4 4-4 4"/></svg>';
}

function catHref(c) { return `/koleksiyon/?k=${encodeURIComponent(c.id)}`; }

export function initChrome({ config, site, current = "" }) {
  const store = config.store;
  const cats = site.categories.filter((c) => c.visible !== false);
  const barCats = cats.filter((c) => c.inBar);
  const params = new URLSearchParams(location.search);
  const activeCat = params.get("k");
  const wa = whatsappHref(store.whatsapp || store.phone, "Merhaba, bilgi almak istiyorum.");

  const nav = [
    ["/", "Ana Sayfa", "home"],
    ["/fiyatlar/", "Canlı Fiyatlar", "prices"],
    ["/#hakkimizda", "Hakkımızda", "about"],
    ["/#magaza", "Mağaza", "store"],
  ];

  const top = document.getElementById("chrome-top");
  top.innerHTML = `
    ${config.announcement?.enabled && config.announcement.text ? `<div class="announce ${config.announcement.style === "warning" ? "warning" : ""}">${esc(config.announcement.text)}</div>` : ""}
    <div class="ticker" aria-label="Canlı fiyat bandı">
      <div class="ticker-live"><span class="dot off" data-live-dot></span>CANLI</div>
      <div class="ticker-track" data-ticker></div>
    </div>
    <header class="site-header">
      <div class="wrap header-row">
        <a class="brand" href="/" aria-label="${esc(store.name)} ana sayfa">
          <img src="/assets/mark.svg" alt="" width="52" height="40">
          <span class="brand-name">Mercan<small>Kuyumculuk</small></span>
        </a>
        <nav class="nav" aria-label="Ana menü">
          <a href="/" ${current === "home" ? 'aria-current="page"' : ""}>Ana Sayfa</a>
          <div class="has-mega">
            <button type="button" aria-expanded="false" aria-haspopup="true" ${current === "collection" ? 'style="color:var(--gold)"' : ""}>Koleksiyon ${I.chevron}</button>
            <div class="mega" role="menu">
              ${cats.map((c) => `<a role="menuitem" href="${catHref(c)}">${iconSvg(iconFor(c))}<div><b>${esc(c.title)}</b><span>${esc(c.subtitle)}</span></div></a>`).join("")}
            </div>
          </div>
          ${nav.slice(1).map(([href, label, key]) => `<a href="${href}" ${current === key ? 'aria-current="page"' : ""}>${label}</a>`).join("")}
        </nav>
        <div class="header-cta">
          <a class="btn small" href="#" data-store="phone-href">${I.phone}<span data-store="phone"></span></a>
          <a class="btn small gold" href="${wa}" target="_blank" rel="noopener">${I.wa}WhatsApp</a>
        </div>
        <button class="burger" type="button" aria-label="Menüyü aç" aria-expanded="false"><span></span><span></span><span></span></button>
      </div>
      ${barCats.length ? `
      <div class="bar-row">
        <div class="wrap bangles" aria-label="Bilezik çeşitleri">
          <span class="label">Bilezikler</span>
          ${barCats.map((c) => `<a href="${catHref(c)}" ${activeCat === c.id ? 'aria-current="true"' : ""}>${iconSvg(iconFor(c))}${esc(c.title)}</a>`).join("")}
        </div>
      </div>` : ""}
    </header>
    <div class="drawer" aria-hidden="true">
      <div class="drawer-bg"></div>
      <div class="drawer-panel" role="dialog" aria-label="Menü">
        <button class="close" type="button" aria-label="Menüyü kapat">×</button>
        ${nav.map(([href, label]) => `<a href="${href}">${label}</a>`).join("")}
        <h4>Koleksiyon</h4>
        <div class="drawer-cats">${cats.map((c) => `<a href="${catHref(c)}">${esc(c.title)}</a>`).join("")}</div>
        <a class="btn gold" href="${wa}" target="_blank" rel="noopener">${I.wa}WhatsApp’tan yazın</a>
        <a class="btn" href="#" data-store="phone-href">${I.phone}Hemen arayın</a>
      </div>
    </div>`;

  const bottom = document.getElementById("chrome-bottom");
  bottom.innerHTML = `
    <footer class="site-footer">
      <div class="wrap">
        <div class="foot-grid">
          <div>
            <a class="brand" href="/"><img src="/assets/mark.svg" alt="" width="52" height="40"><span class="brand-name">Mercan<small>Kuyumculuk</small></span></a>
            <p>Osmaniye’de altın, bilezik, ziynet ve takıda güvenilir adres. Fiyatlar bilgi amaçlıdır; kesin fiyat için mağazamıza danışın.</p>
          </div>
          <div><h4>Koleksiyon</h4><ul>${cats.slice(0, 7).map((c) => `<li><a href="${catHref(c)}">${esc(c.title)}</a></li>`).join("")}</ul></div>
          <div><h4>Sayfalar</h4><ul>
            <li><a href="/fiyatlar/">Canlı fiyatlar</a></li>
            <li><a href="/koleksiyon/">Tüm koleksiyon</a></li>
            <li><a href="/#magaza">Mağaza ve iletişim</a></li>
            <li><a href="/destek/">Destek</a></li>
            <li><a href="/gizlilik/">Gizlilik politikası</a></li>
          </ul></div>
          <div><h4>İletişim</h4><ul>
            <li><a href="#" data-store="phone-href"><span data-store="phone"></span></a></li>
            <li><a href="${wa}" target="_blank" rel="noopener">WhatsApp</a></li>
            <li><a href="#" data-store="instagram-href" target="_blank" rel="noopener"><span data-store="instagram"></span></a></li>
            <li><a href="#" data-store="email-href"><span data-store="email"></span></a></li>
            <li><a href="#" data-store="maps-href" target="_blank" rel="noopener">Yol tarifi al</a></li>
          </ul></div>
        </div>
        <div class="foot-bottom">
          <span>© ${new Date().getFullYear()} ${esc(store.name)} · ${esc(store.city || "Osmaniye")}</span>
          <span>Piyasa verileri: Harem Altın · bilgi amaçlıdır</span>
        </div>
      </div>
    </footer>
    <a class="wa-fab" href="${wa}" target="_blank" rel="noopener" aria-label="WhatsApp ile yazın">${I.wa}</a>`;

  fillStore(store);
  wireMenus();
}

function wireMenus() {
  const mega = document.querySelector(".has-mega");
  if (mega) {
    const btn = mega.querySelector("button");
    let t = 0;
    const set = (open) => { mega.classList.toggle("open", open); btn.setAttribute("aria-expanded", String(open)); };
    btn.addEventListener("click", () => set(!mega.classList.contains("open")));
    mega.addEventListener("mouseenter", () => { clearTimeout(t); set(true); });
    mega.addEventListener("mouseleave", () => { t = setTimeout(() => set(false), 180); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") set(false); });
    document.addEventListener("click", (e) => { if (!mega.contains(e.target)) set(false); });
  }
  const drawer = document.querySelector(".drawer");
  const burger = document.querySelector(".burger");
  const setDrawer = (open) => {
    drawer.classList.toggle("open", open);
    drawer.setAttribute("aria-hidden", String(!open));
    burger.setAttribute("aria-expanded", String(open));
    document.body.style.overflow = open ? "hidden" : "";
  };
  burger.addEventListener("click", () => setDrawer(true));
  drawer.querySelector(".close").addEventListener("click", () => setDrawer(false));
  drawer.querySelector(".drawer-bg").addEventListener("click", () => setDrawer(false));
  drawer.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setDrawer(false)));
}

/** Rebuilds the ticker from the latest prices (twice, for a seamless loop). */
export function updateTicker(quotes, catalog) {
  const track = document.querySelector("[data-ticker]");
  if (!track) return;
  const parts = [];
  for (const [code, label] of TICKER) {
    const q = quotes.get(code);
    if (!q || q.sell == null) continue;
    const p = catalog.get(code);
    const c = q.changePct;
    const cls = c == null ? "" : c >= 0 ? "up" : "down";
    parts.push(`<span class="ticker-item"><b>${label}</b><span class="v">${fmt(q.sell, siteDecimals(p))}</span>${c != null ? `<span class="c ${cls}">${c >= 0 ? "▲" : "▼"} ${fmtPct(c)}</span>` : ""}</span>`);
  }
  if (!parts.length) return;
  const html = parts.join("");
  if (track.dataset.html === html) return;
  track.dataset.html = html;
  track.innerHTML = html + html;
}

export function setLiveDot(status) {
  for (const d of document.querySelectorAll("[data-live-dot]")) d.classList.toggle("off", status !== "live");
}

/** Fades sections in as they scroll into view. */
export function reveal() {
  const els = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("in")); return; }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }, { rootMargin: "0px 0px -8% 0px" });
  els.forEach((e) => io.observe(e));
}

/** Briefly colours a number green/red when it moves. */
export function flash(el, dir) {
  if (!el || !dir) return;
  el.classList.remove("flash-up", "flash-down");
  void el.offsetWidth;
  el.classList.add(dir === "up" ? "flash-up" : "flash-down");
}
