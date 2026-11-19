// Product cards with gram options. The price of a weight is gram × the sell price of the
// product's priceCode (e.g. 22 ayar) after the admin's overrides, same as ItemPricing.kt.
import { esc, fmt, whatsappHref } from "./live.js?v=202611191210";
import { GRAM_PRICES, gramLabel, iconFor, iconSvg } from "./site-defaults.js?v=202611191210";

export function itemPrice(item, quotes, gram) {
  const unit = item.priceCode ? quotes.get(item.priceCode)?.sell : null;
  return unit != null && gram > 0 ? gram * unit : null;
}

const priceName = (code) => GRAM_PRICES.find(([c]) => c === code)?.[1] || "";

/** Renders product cards into [root]; returns {update(quotes)} for live prices. */
export function renderProducts(root, items, cats, store) {
  const chosen = new Map(items.map((p) => [p.id, p.grams?.[0] ?? null]));
  let quotes = new Map();
  const wa = store.whatsapp || store.phone;

  root.innerHTML = items.map((p) => {
    const c = cats.find((x) => x.id === p.categoryId) || {};
    const grams = p.grams || [];
    const meta = [p.detail, p.priceCode && grams.length ? `${priceName(p.priceCode)} gram fiyatından` : ""].filter(Boolean)[0] || "";
    return `<article class="item reveal" data-id="${esc(p.id)}">
      <div class="ph">${p.image ? `<img src="/api/media/${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">` : iconSvg(iconFor(c))}</div>
      <div class="body">
        ${meta ? `<span class="detail">${esc(meta)}</span>` : ""}
        <h3>${esc(p.name)}</h3>
        ${p.description ? `<p>${esc(p.description)}</p>` : ""}
        ${grams.length > 1 ? `<div class="grams" role="group" aria-label="Gram seçin">${grams.map((g, i) => `<button type="button" data-g="${g}" aria-pressed="${i === 0}">${gramLabel(g)}</button>`).join("")}</div>` : ""}
        ${grams.length && p.priceCode ? `<div class="price"><b data-price>—</b><span data-unit></span></div>` : grams.length === 1 ? `<div class="price"><b>${gramLabel(grams[0])}</b></div>` : ""}
        <a class="btn small" data-ask href="#" target="_blank" rel="noopener">WhatsApp’tan sor</a>
      </div></article>`;
  }).join("");

  const paint = (card) => {
    const p = items.find((x) => x.id === card.dataset.id);
    const g = chosen.get(p.id);
    const price = card.querySelector("[data-price]");
    const total = itemPrice(p, quotes, g);
    if (price) {
      price.textContent = total == null ? "—" : `${fmt(total, 0)} ₺`;
      card.querySelector("[data-unit]").textContent = g ? `${gramLabel(g)} · ${priceName(p.priceCode)}` : "";
    }
    const text = `Merhaba, "${p.name}"${g ? ` (${gramLabel(g)})` : ""} hakkında bilgi almak istiyorum.`;
    card.querySelector("[data-ask]").href = whatsappHref(wa, text);
  };

  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-g]");
    if (!b) return;
    const card = b.closest(".item");
    chosen.set(card.dataset.id, Number(b.dataset.g));
    for (const x of b.parentElement.children) x.setAttribute("aria-pressed", String(x === b));
    paint(card);
  });

  const all = () => root.querySelectorAll(".item").forEach(paint);
  all();
  return { update(q) { quotes = q; all(); } };
}
