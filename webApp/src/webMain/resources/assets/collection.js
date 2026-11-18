import { esc, loadCatalog, loadConfig, startLive, whatsappHref } from "./live.js?v=202611182247";
import { iconFor, iconSvg, siteContent } from "./site-defaults.js?v=202611182247";
import { arrowIcon, initChrome, reveal } from "./chrome.js?v=202611182247";
import { renderProducts } from "./products.js?v=202611182247";

const [config] = await Promise.all([loadConfig(), loadCatalog()]);
const site = siteContent(config);
initChrome({ config, site, current: "collection" });

const cats = site.categories.filter((c) => c.visible !== false);
const items = site.items.filter((p) => p.visible !== false);
const k = new URLSearchParams(location.search).get("k");
const cat = cats.find((c) => c.id === k);
const wa = config.store.whatsapp || config.store.phone;

document.querySelector("[data-chips]").innerHTML =
  `<a href="/koleksiyon/" ${!cat ? 'aria-current="true"' : ""}>Tümü</a>` +
  cats.map((c) => `<a href="/koleksiyon/?k=${encodeURIComponent(c.id)}" ${cat?.id === c.id ? 'aria-current="true"' : ""}>${esc(c.title)}</a>`).join("");

if (cat) {
  document.title = `${cat.title} · Mercan Kuyumculuk Osmaniye`;
  document.querySelector("[data-title]").textContent = cat.title;
  if (cat.subtitle) document.querySelector("[data-sub]").textContent = `${cat.subtitle}. Gramını seçin, güncel fiyatını görün; beğendiğiniz modeli WhatsApp’tan sorun.`;
}

const shown = cat ? items.filter((p) => p.categoryId === cat.id) : items;
const list = document.querySelector("[data-list]");
let products = null;
if (shown.length) {
  list.className = "items";
  products = renderProducts(list, shown, cats, config.store);
} else if (cat) {
  list.innerHTML = `<div class="empty-state">${iconSvg(iconFor(cat))}<h3>${esc(cat.title)} modellerimiz mağazamızda</h3>
    <p>Bu kategorideki güncel modelleri ve fiyatları WhatsApp’tan sorun, fotoğraflarını hemen gönderelim.</p>
    <a class="btn" href="${whatsappHref(wa, `Merhaba, ${cat.title} modellerinizi görmek istiyorum.`)}" target="_blank" rel="noopener">${esc(cat.title)} modellerini sorun</a></div>`;
} else {
  list.className = "cats";
  list.innerHTML = cats.map((c) => `<a class="cat reveal" href="/koleksiyon/?k=${encodeURIComponent(c.id)}">
    <div class="art">${c.image ? `<img src="/api/media/${esc(c.image)}" alt="" loading="lazy">` : iconSvg(iconFor(c))}</div>
    <div class="t"><div><h3>${esc(c.title)}</h3><p>${esc(c.subtitle)}</p></div><span class="go">${arrowIcon()}</span></div></a>`).join("");
}

if (products) startLive({ config, onUpdate: (q) => products.update(q) });
reveal();
