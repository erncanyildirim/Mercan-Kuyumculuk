// Live price table with group tabs, used on the home page and on /fiyatlar/.
import { esc, fmt, fmtPct, productName, siteDecimals } from "./live.js?v=202611191210";
import { flash } from "./chrome.js?v=202611191210";

export const GROUPS = [
  ["GOLD", "Altın"], ["COINS", "Sarrafiye"], ["CURRENCY", "Döviz"], ["METALS", "Emtia"], ["PARITY", "Parite"],
];

/**
 * Renders into [root] (needs [data-tabs] and [data-rows]). [limit] keeps only the first N rows per group
 * (home page); [groups] limits which tabs exist.
 */
export function createBoard(root, catalog, { limit = 0, groups = GROUPS } = {}) {
  let group = groups[0][0];
  let quotes = new Map();
  const tabs = root.querySelector("[data-tabs]");
  const body = root.querySelector("[data-rows]");
  tabs.innerHTML = groups.map(([g, t]) => `<button type="button" role="tab" data-g="${g}" aria-selected="${g === group}">${t}</button>`).join("");
  tabs.addEventListener("click", (e) => {
    const b = e.target.closest("[data-g]");
    if (!b) return;
    group = b.dataset.g;
    for (const x of tabs.children) x.setAttribute("aria-selected", String(x === b));
    body.dataset.key = "";
    render(true);
  });

  function rows() {
    let list = [...catalog.values()].filter((p) => p.group === group && quotes.has(p.code));
    if (limit) list = list.slice(0, limit);
    return list;
  }

  function render(full = false) {
    const list = rows();
    const key = list.map((p) => p.code).join(",");
    if (full || body.dataset.key !== key) {
      body.dataset.key = key;
      body.innerHTML = list.length ? list.map((p) => `
        <tr data-code="${p.code}">
          <td><span class="name">${esc(productName(p))}</span>${hint(p)}</td>
          <td data-f="buy"></td>
          <td class="sell" data-f="sell"></td>
          <td class="chg col-chg" data-f="chg"></td>
        </tr>`).join("") : `<tr><td colspan="4" style="text-align:center;color:var(--ivory-mute)">Fiyatlar yükleniyor…</td></tr>`;
    }
    for (const tr of body.querySelectorAll("tr[data-code]")) {
      const p = catalog.get(tr.dataset.code);
      const q = quotes.get(p.code);
      const d = siteDecimals(p);
      const cur = p.currency && p.currency !== "₺" ? `${p.currency} ` : "";
      set(tr.querySelector('[data-f="buy"]'), q.buy == null ? "—" : cur + fmt(q.buy, d), q.changed && q.buyTick);
      set(tr.querySelector('[data-f="sell"]'), q.sell == null ? "—" : cur + fmt(q.sell, d), q.changed && q.sellTick);
      const c = q.changePct;
      const chg = tr.querySelector('[data-f="chg"]');
      const html = c == null ? '<span style="color:var(--ivory-mute)">—</span>' : `<span class="${c >= 0 ? "up" : "down"}"><i class="arrow ${c >= 0 ? "up" : "down"}"></i>${fmtPct(c)}</span>`;
      if (chg.innerHTML !== html) chg.innerHTML = html;
    }
  }

  function set(el, text, tick) {
    if (el.textContent === text) return;
    const had = el.textContent !== "";
    el.textContent = text;
    if (had && tick) flash(el, tick);
  }

  return {
    update(q) { quotes = q; render(); },
  };
}

function hint(p) {
  const bits = [];
  if (p.unitHint && p.code !== "ALTIN") bits.push(p.unitHint);
  return bits.length ? `<span class="hint">${esc(bits.join(" · "))}</span>` : "";
}
