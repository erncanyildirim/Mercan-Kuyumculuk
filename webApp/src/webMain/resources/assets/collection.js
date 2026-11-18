import { esc, loadCatalog, loadConfig, startLive, whatsappHref } from "./live.js";
import { iconFor, iconSvg, siteContent } from "./site-defaults.js";
import { initChrome, reveal, setLiveDot, updateTicker } from "./chrome.js";

const [config, catalog] = await Promise.all([loadConfig(), loadCatalog()]);
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
  if (cat.subtitle) document.querySelector("[data-sub]").textContent = `${cat.subtitle}. Beğendiğiniz modeli WhatsApp’tan sorun, güncel fiyatı hemen iletelim.`;
}

const shown = cat ? items.filter((p) => p.categoryId === cat.id) : items;
const list = document.querySelector("[data-list]");
if (shown.length) {
  list.className = "items";
  list.innerHTML = shown.map((p, i) => {
    const c = cats.find((x) => x.id === p.categoryId);
    const ask = whatsappHref(wa, `Merhaba, "${p.name}"${p.detail ? ` (${p.detail})` : ""} hakkında bilgi almak istiyorum.`);
    return `<article class="item reveal" style="transition-delay:${(i % 4) * 60}ms">
      <div class="ph ${p.image ? "" : "empty"}">${p.image ? `<img src="/api/media/${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">` : iconSvg(iconFor(c || {}))}</div>
      <div class="body">
        ${p.detail ? `<span class="detail">${esc(p.detail)}</span>` : ""}
        <h3>${esc(p.name)}</h3>
        ${p.description ? `<p>${esc(p.description)}</p>` : ""}
        <a class="btn gold small" href="${ask}" target="_blank" rel="noopener">WhatsApp’tan sor</a>
      </div></article>`;
  }).join("");
} else if (cat) {
  list.innerHTML = `<div class="empty-state">${iconSvg(iconFor(cat), "")}<h3>${esc(cat.title)} modellerimiz mağazamızda</h3>
    <p>Bu kategorideki güncel modelleri ve fiyatları WhatsApp’tan sorun, fotoğraflarını hemen gönderelim.</p>
    <a class="btn gold" href="${whatsappHref(wa, `Merhaba, ${cat.title} modellerinizi görmek istiyorum.`)}" target="_blank" rel="noopener">${esc(cat.title)} modellerini sor</a></div>`;
  list.querySelector("svg").style.cssText = "width:64px;height:64px;color:var(--gold)";
} else {
  list.className = "cats";
  list.innerHTML = cats.map((c) => `<a class="cat reveal" href="/koleksiyon/?k=${encodeURIComponent(c.id)}">
    ${c.image ? `<div class="art photo"><img src="/api/media/${esc(c.image)}" alt="" loading="lazy"></div>` : `<div class="art">${iconSvg(iconFor(c))}</div>`}
    <h3>${esc(c.title)}</h3><p>${esc(c.subtitle)}</p></a>`).join("");
}
list.style.marginBottom = "80px";

startLive({ config, onStatus: setLiveDot, onUpdate: (q) => updateTicker(q, catalog) });
reveal();
