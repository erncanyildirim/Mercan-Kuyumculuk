// "Web sitesi" tab of the admin panel: categories, products (with photos), TV board and story card.
// Edits config.site in place; texts use the generic [data-field] binding in admin.js.
import { DEFAULT_SITE, GRAM_PRICES, gramLabel } from "../assets/site-defaults.js";
import { esc } from "../assets/live.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const MAX = { categories: 40, items: 300, tv: 12, story: 8 };
const PHOTO_EDGE = 1200;

// Built-in line drawings for category cards (symbols "a-<key>" in index.html).
export const CATEGORY_ICONS = [
  ["", "Otomatik"], ["coin", "Madeni para (ziynet)"], ["bangle", "Bilezik"], ["twist", "Burgu bilezik"],
  ["chain", "Zincir"], ["ring", "Yüzük"], ["gem", "Pırlanta"], ["heart", "Kalp"],
  ["necklace", "Kolye"], ["earring", "Küpe"], ["bar", "Külçe altın"],
];

let ctx = null; // { getConfig, onChange, getToken, catalog, toast }
let itemFilter = "";

/** Adds the default content when the jeweler has never saved site content. */
export function ensureSite(config) {
  if (!config.site) config.site = structuredClone(DEFAULT_SITE);
  for (const k of ["categories", "items", "tv", "story"]) config.site[k] ??= [];
  config.site.hero ??= { ...DEFAULT_SITE.hero };
  config.site.about ??= { ...DEFAULT_SITE.about };
}

export function initSite(options) {
  ctx = options;
  $("#add-category").addEventListener("click", () => {
    const s = site();
    if (s.categories.length >= MAX.categories) return ctx.toast(`En fazla ${MAX.categories} kategori olabilir`);
    s.categories.push({ id: newId("kategori", s.categories), title: "Yeni kategori", subtitle: "", visible: true, inBar: false });
    changed();
    renderSite();
    $$("#categories input[data-k=title]").at(-1)?.select();
  });
  $("#add-item").addEventListener("click", () => {
    const s = site();
    if (!s.categories.length) return ctx.toast("Önce bir kategori ekleyin");
    if (s.items.length >= MAX.items) return ctx.toast(`En fazla ${MAX.items} ürün olabilir`);
    const categoryId = itemFilter || s.categories[0].id;
    s.items.unshift({ id: newId("urun", s.items), categoryId, name: "Yeni ürün", detail: "", description: "", image: "", visible: true, grams: [], priceCode: "AYAR22" });
    changed();
    renderSite();
    $("#items input[data-k=name]")?.select();
  });
  $("#item-filter").addEventListener("change", (e) => { itemFilter = e.target.value; renderItems(); });
  for (const kind of ["tv", "story"]) {
    $(`#add-${kind}`).addEventListener("click", () => {
      const rows = site()[kind];
      if (rows.length >= MAX[kind]) return ctx.toast(`En fazla ${MAX[kind]} satır olabilir`);
      rows.push(kind === "story" ? { code: "ALTIN", label: "HAS", note: "" } : { code: "ALTIN", label: "HAS" });
      changed();
      renderTiles(kind);
    });
  }
}

export function renderSite() {
  renderCategories();
  renderItems();
  renderTiles("tv");
  renderTiles("story");
}

function site() { return ctx.getConfig().site; }
function changed() { ctx.onChange(); }

function newId(prefix, list) {
  let id;
  do id = `${prefix}-${Math.random().toString(36).slice(2, 8)}`; while (list.some((x) => x.id === id));
  return id;
}

function moveButtons(list, i, rerender) {
  const wrap = document.createElement("div");
  wrap.className = "row-actions";
  wrap.innerHTML = `
    <button type="button" class="ghost small" data-act="up" aria-label="Yukarı taşı" ${i === 0 ? "disabled" : ""}>↑</button>
    <button type="button" class="ghost small" data-act="down" aria-label="Aşağı taşı" ${i === list.length - 1 ? "disabled" : ""}>↓</button>`;
  wrap.addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act !== "up" && act !== "down") return;
    const j = act === "up" ? i - 1 : i + 1;
    [list[i], list[j]] = [list[j], list[i]];
    changed();
    rerender();
  });
  return wrap;
}

function bindInputs(root, target, rerender) {
  for (const el of $$("[data-k]", root)) {
    const k = el.dataset.k;
    if (el.type === "checkbox") el.checked = k === "inBar" ? target[k] === true : target[k] !== false;
    else el.value = target[k] ?? "";
    el.addEventListener(el.tagName === "SELECT" || el.type === "checkbox" ? "change" : "input", () => {
      target[k] = el.type === "checkbox" ? el.checked : el.value;
      changed();
      if (el.dataset.rerender !== undefined) rerender();
    });
  }
}

// ---------- categories ----------

function renderCategories() {
  const s = site();
  const root = $("#categories");
  root.innerHTML = "";
  if (!s.categories.length) root.innerHTML = '<p class="muted">Kategori yok. Ana sayfada koleksiyon bölümü gizlenir.</p>';
  s.categories.forEach((c, i) => {
    const count = s.items.filter((p) => p.categoryId === c.id).length;
    const row = document.createElement("div");
    row.className = "list-row";
    row.innerHTML = `
      <div class="cat-thumb">${c.image ? `<img src="/api/media/${esc(c.image)}" alt="">` : '<span class="muted small-text">Simge</span>'}</div>
      <div class="grow three">
        <label>Kategori adı <input data-k="title" maxlength="40" required></label>
        <label>Kısa açıklama <input data-k="subtitle" maxlength="80"></label>
        <label>Kart simgesi <select data-k="icon" ${c.image ? "disabled" : ""}>${CATEGORY_ICONS.map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}</select></label>
      </div>
      <div class="item-actions">
        <label class="ghost small upload">${c.image ? "Fotoğrafı değiştir" : "Fotoğraf yükle"}<input type="file" accept="image/jpeg,image/png,image/webp" hidden></label>
        ${c.image ? '<button type="button" class="ghost small" data-act="nophoto">Fotoğrafı kaldır</button>' : ""}
        <label class="check"><input type="checkbox" data-k="visible"> Göster</label>
        <label class="check" title="Sitenin üst kısmındaki bilezik çubuğunda gösterilir"><input type="checkbox" data-k="inBar"> Bilezik çubuğunda</label>
        <span class="muted small-text">${count} ürün</span>
      </div>
      <p class="error small-text" data-upload-status></p>`;
    bindInputs(row, c, renderCategories);
    $("input[type=file]", row).addEventListener("change", async (e) => {
      const id = await uploadImage(e.target.files[0], $("[data-upload-status]", row));
      if (!id) return;
      c.image = id;
      changed();
      renderCategories();
      ctx.toast("Fotoğraf yüklendi. Görünmesi için Kaydet’e basın.");
    });
    $("[data-act=nophoto]", row)?.addEventListener("click", () => {
      c.image = "";
      changed();
      renderCategories();
    });
    row.append(moveButtons(s.categories, i, renderSite));
    const del = document.createElement("button");
    del.type = "button";
    del.className = "ghost small danger";
    del.textContent = "Sil";
    del.addEventListener("click", () => {
      const msg = count
        ? `“${c.title}” kategorisi ve içindeki ${count} ürün silinsin mi?`
        : `“${c.title}” kategorisi silinsin mi?`;
      if (!confirm(msg)) return;
      s.categories.splice(i, 1);
      s.items = s.items.filter((p) => p.categoryId !== c.id);
      if (itemFilter === c.id) itemFilter = "";
      changed();
      renderSite();
    });
    row.append(del);
    root.append(row);
  });
  // Category names also feed the product filter and the product category selects.
  const filter = $("#item-filter");
  filter.innerHTML = `<option value="">Tüm kategoriler</option>` +
    s.categories.map((c) => `<option value="${esc(c.id)}">${esc(c.title)}</option>`).join("");
  filter.value = itemFilter;
  $("#add-category").disabled = s.categories.length >= MAX.categories;
}

// ---------- products ----------

function renderItems() {
  const s = site();
  const root = $("#items");
  root.innerHTML = "";
  const options = s.categories.map((c) => `<option value="${esc(c.id)}">${esc(c.title)}</option>`).join("");
  const shown = s.items.filter((p) => !itemFilter || p.categoryId === itemFilter);
  $("#item-count").textContent = `${s.items.length} ürün`;
  if (!shown.length) {
    root.innerHTML = '<p class="muted">Henüz ürün yok. “+ Ürün ekle” ile fotoğraflı ürün ekleyebilirsiniz; ürünü olan kategoriler ana sayfada “model” sayısıyla görünür.</p>';
  }
  for (const p of shown) {
    const card = document.createElement("div");
    card.className = "item-card";
    card.innerHTML = `
      <div class="photo">
        ${p.image ? `<img src="/api/media/${esc(p.image)}" alt="">` : '<span class="muted small-text">Fotoğraf yok</span>'}
      </div>
      <div class="fields">
        <div class="two">
          <label>Ürün adı <input data-k="name" maxlength="60" required></label>
          <label>Kategori <select data-k="categoryId" data-rerender>${options}</select></label>
        </div>
        <div class="two">
          <label>Fiyat hesabı
            <select data-k="priceCode" data-rerender>
              <option value="">Fiyat gösterme</option>
              ${GRAM_PRICES.map(([c, t]) => `<option value="${c}">${t} gram fiyatından</option>`).join("")}
            </select>
          </label>
          <label>Gram seçenekleri <input data-grams placeholder="örn. 10; 15; 20; 22,5" inputmode="decimal"></label>
        </div>
        <p class="muted small-text" data-gram-preview></p>
        <label>Kısa bilgi <input data-k="detail" maxlength="60" placeholder="örn. 22 ayar · kilitli"></label>
        <label>Açıklama <textarea data-k="description" rows="2" maxlength="400"></textarea></label>
        <div class="item-actions">
          <label class="ghost small upload">Fotoğraf seç<input type="file" accept="image/jpeg,image/png,image/webp" hidden></label>
          ${p.image ? '<button type="button" class="ghost small" data-act="nophoto">Fotoğrafı kaldır</button>' : ""}
          <label class="check"><input type="checkbox" data-k="visible"> Göster</label>
          <button type="button" class="ghost small danger" data-act="delete">Sil</button>
        </div>
        <p class="error small-text" data-upload-status></p>
      </div>`;
    bindInputs(card, p, renderItems);
    bindGrams(card, p);
    $("input[type=file]", card).addEventListener("change", (e) => upload(p, e.target.files[0], card));
    card.addEventListener("click", (e) => {
      const act = e.target.closest("[data-act]")?.dataset.act;
      if (act === "nophoto") {
        p.image = "";
        changed();
        renderItems();
      } else if (act === "delete") {
        if (!confirm(`“${p.name}” silinsin mi?`)) return;
        s.items.splice(s.items.indexOf(p), 1);
        changed();
        renderSite();
      }
    });
    root.append(card);
  }
  $("#add-item").disabled = s.items.length >= MAX.items;
}

/** Gram options separated by ";" or spaces (a comma is the decimal sign: 22,5). */
export function parseGrams(text) {
  const parts = String(text).split(/[;\s]+/).map((t) => t.trim().replace(",", ".")).filter(Boolean);
  const nums = parts.map(Number);
  if (nums.length > 12 || !nums.every((n) => Number.isFinite(n) && n > 0 && n <= 10000)) return null;
  return [...new Set(nums.map((n) => Math.round(n * 100) / 100))].sort((a, b) => a - b);
}

/** Gram options input; the preview prices each weight with the current gram price. */
function bindGrams(card, p) {
  const input = $("[data-grams]", card);
  const preview = $("[data-gram-preview]", card);
  p.grams ??= [];
  p.priceCode ??= "";
  input.value = p.grams.map((g) => String(g).replace(".", ",")).join("; ");
  const show = () => {
    const unit = ctx.gramPrice?.(p.priceCode);
    const list = p.grams.map(gramLabel).join(" · ");
    if (!p.grams.length) preview.textContent = "Gramları noktalı virgülle yazın (örn. 10; 15; 22,5). Müşteri sitede ve uygulamada gramı seçer, fiyat gram fiyatınıza göre hesaplanır.";
    else if (!p.priceCode) preview.textContent = `Seçenekler: ${list} (fiyat gösterilmez)`;
    else if (unit == null) preview.textContent = `Seçenekler: ${list} · fiyat bekleniyor`;
    else preview.textContent = "Şu anki fiyat: " + p.grams.map((g) => `${gramLabel(g)} = ${Math.round(g * unit).toLocaleString("tr-TR")} ₺`).join(" · ");
  };
  input.addEventListener("input", () => {
    const grams = parseGrams(input.value);
    input.setCustomValidity(grams ? "" : "Gramları noktalı virgülle ayırın, örn. 10; 12,5; 20");
    if (grams) p.grams = grams;
    changed();
    show();
  });
  show();
  card._showGrams = show;
}

/** Re-renders the gram price previews when live prices move. */
export function refreshGramPreviews() {
  for (const card of $$("#items .item-card")) card._showGrams?.();
}

/** Shrinks the photo in the browser (max 1200 px, JPEG) and uploads it. */
async function upload(item, file, card) {
  const id = await uploadImage(file, $("[data-upload-status]", card));
  if (!id) return;
  item.image = id;
  changed();
  renderItems();
  ctx.toast("Fotoğraf yüklendi. Görünmesi için Kaydet’e basın.");
}

/** Shrinks and uploads a photo; returns its media id, or null after showing the error. */
async function uploadImage(file, status) {
  if (!file) return null;
  status.className = "muted small-text";
  status.textContent = "Fotoğraf yükleniyor…";
  try {
    const blob = await shrink(file);
    const res = await fetch("/api/admin/media", {
      method: "POST",
      headers: { "Content-Type": blob.type, Authorization: `Bearer ${ctx.getToken()}` },
      body: blob,
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(body?.error || `Sunucu hatası (${res.status})`);
    status.textContent = "";
    return body.id;
  } catch (e) {
    status.className = "error small-text";
    status.textContent = `Yüklenemedi: ${e.message}`;
    return null;
  }
}

async function shrink(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, PHOTO_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const g = canvas.getContext("2d");
  g.fillStyle = "#fff";
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Fotoğraf okunamadı"))), "image/jpeg", 0.85));
}

// ---------- TV board and story card ----------

function renderTiles(kind) {
  const rows = site()[kind];
  const root = $(`#${kind}-rows`);
  root.innerHTML = "";
  const options = ctx.catalog
    .map((p) => `<option value="${esc(p.code)}">${esc(p.groupTitle)} · ${esc(p.name)}${p.variant ? ` (${esc(p.variant)})` : ""}</option>`)
    .join("");
  rows.forEach((t, i) => {
    const row = document.createElement("div");
    row.className = "list-row";
    row.innerHTML = `
      <div class="grow ${kind === "story" ? "three" : "two"}">
        <label>Ürün <select data-k="code">${options}</select></label>
        <label>Ekranda yazan <input data-k="label" maxlength="20" required></label>
        ${kind === "story" ? '<label>Alt yazı <input data-k="note" maxlength="30" placeholder="örn. yeni basım"></label>' : ""}
      </div>`;
    bindInputs(row, t, () => renderTiles(kind));
    row.append(moveButtons(rows, i, () => renderTiles(kind)));
    const del = document.createElement("button");
    del.type = "button";
    del.className = "ghost small danger";
    del.textContent = "Sil";
    del.addEventListener("click", () => {
      rows.splice(i, 1);
      changed();
      renderTiles(kind);
    });
    row.append(del);
    root.append(row);
  });
  if (!rows.length) root.innerHTML = '<p class="muted">Satır yok; ekran varsayılan fiyatları gösterir.</p>';
  $(`#add-${kind}`).disabled = rows.length >= MAX[kind];
}
