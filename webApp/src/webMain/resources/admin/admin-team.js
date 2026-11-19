// Membership side of the admin panel: dashboard, till (coupon use), members, member prices,
// coupons, notifications, staff with permissions, and the activity log.
import { esc } from "../assets/live.js?v=202611191200";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

let ctx = null; // { api, getConfig, onChange, catalog, priced, user, toast, can, openTab }
let membersCache = null;

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" }) : "—");
const fmtDay = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("tr-TR", { dateStyle: "medium" }) : "");
const phoneText = (p) => String(p).replace(/^90(\d{3})(\d{3})(\d{2})(\d{2})$/, "0$1 $2 $3 $4");
const money = (n) => Number(n).toLocaleString("tr-TR", { maximumFractionDigits: 2 });

export const COUPON_KINDS = {
  percent: (v) => `%${money(v)} indirim`,
  amount: (v) => `${money(v)} ₺ indirim`,
  gram: (v) => `Gram başına ${money(v)} ₺ indirim`,
  gift: () => "Hediye / özel teklif",
};

export function initTeam(options) {
  ctx = options;
}

/** Renders a panel when it is opened. */
export function showTeamPanel(name) {
  const panel = $(`[data-panel="${name}"]`);
  if (!panel) return;
  const fn = { dashboard, kasa, members, memberPrices, coupons, notify, staff, logs }[name];
  if (fn) fn(panel).catch((e) => { if (e.message !== "unauthorized") panel.innerHTML = `<div class="card error">${esc(e.message)}</div>`; });
}

/** Called when the config was reloaded or discarded (member prices live in the config). */
export function refreshTeam() {
  const p = $('[data-panel="memberPrices"]');
  if (p && !p.hidden) memberPrices(p);
}

async function loadMembers(force = false) {
  if (!membersCache || force) membersCache = (await ctx.api("/api/admin/members")).members;
  return membersCache;
}

// ---------- dashboard ----------

async function dashboard(panel) {
  panel.innerHTML = '<div class="card">Yükleniyor…</div>';
  const s = await ctx.api("/api/admin/stats");
  const box = (n, label, tab) => `<div class="stat ${tab && ctx.can(tab[1]) ? "link" : ""}" ${tab ? `data-go="${tab[0]}"` : ""}><b>${n}</b><span>${label}</span></div>`;
  panel.innerHTML = `
    <div class="card"><h2 style="margin:0 0 4px">Hoş geldiniz, ${esc(ctx.user.name)}</h2>
      <p class="muted" style="margin:0">Üyelik ${s.membership.enabled ? '<span class="pill on">açık</span>' : '<span class="pill off">kapalı</span>'} · fiyat ayarları sürüm ${s.prices.version} · son kayıt ${fmtDate(s.prices.updatedAt)}</p></div>
    <div class="stats">
      ${box(s.members.total, "üye", ["members", "members.view"])}
      ${box(s.members.newThisWeek, "bu hafta yeni üye", ["members", "members.view"])}
      ${box(s.coupons.open, "geçerli kupon", ["coupons", "coupons"])}
      ${box(s.coupons.usedThisWeek, "bu hafta kullanılan kupon", ["kasa", "coupons.redeem"])}
      ${box(s.notices.total, "gönderilen bildirim", ["notify", "notify"])}
      ${box(s.prices.custom, "özel fiyatlı ürün", ["prices", "prices"])}
      ${box(s.membership.deals, "üye fiyatlı ürün", ["memberPrices", "memberPrices"])}
      ${box(s.items, "koleksiyonda ürün", ["site", "site"])}
    </div>
    <div class="two" style="align-items:start">
      <div class="card"><h2>Son üyeler</h2>${s.members.recent.length ? `<table class="grid"><tbody>${s.members.recent.map((m) => `<tr><td>${esc(m.name)}<br><span class="muted small-text">${phoneText(m.phone)}</span></td><td class="muted small-text">${fmtDate(m.createdAt)}</td></tr>`).join("")}</tbody></table>` : '<p class="empty">Henüz üye yok.</p>'}</div>
      <div class="card"><h2>Son işlemler</h2>${s.log.length ? `<table class="grid"><tbody>${s.log.map((l) => `<tr><td><b>${esc(l.by)}</b> · ${esc(l.action)}<br><span class="muted small-text">${esc(l.detail)}</span></td><td class="muted small-text">${fmtDate(l.at)}</td></tr>`).join("")}</tbody></table>` : `<p class="empty">${ctx.can("logs") ? "Henüz işlem yok." : "İşlem geçmişini görme yetkiniz yok."}</p>`}</div>
    </div>
    ${s.membership.enabled ? "" : `<div class="card tip">Üyelik şu anda <b>kapalı</b>: müşteriler üye olamaz, üye fiyatları uygulanmaz. ${ctx.can("memberPrices") ? 'Açmak için <a href="#" data-go="memberPrices">Üye fiyatları</a> bölümüne gidin.' : ""}</div>`}`;
  panel.addEventListener("click", (e) => {
    const go = e.target.closest("[data-go]")?.dataset.go;
    if (go) { e.preventDefault(); ctx.openTab(go); }
  }, { once: true });
}

// ---------- till: use a coupon ----------

async function kasa(panel) {
  panel.innerHTML = `
    <div class="card form">
      <h2>Kasa · kupon kullandır</h2>
      <p class="muted">Müşterinin telefon numarasını yazın; üyenin geçerli kuponları listelenir. Kullandığınız kupon üyenin hesabında “kullanıldı” olarak görünür.</p>
      <div class="row"><label>Üyenin telefonu <input id="k-phone" inputmode="tel" placeholder="05XX XXX XX XX"></label><button type="button" class="primary" id="k-find">Üyeyi bul</button></div>
      <div id="k-out"></div>
    </div>
    <div class="card"><h2>Son kullanılan kuponlar</h2><div id="k-recent" class="muted">Yükleniyor…</div></div>`;
  const out = $("#k-out", panel);
  const recent = async () => {
    const { redemptions } = await ctx.api("/api/admin/coupons");
    $("#k-recent", panel).innerHTML = redemptions.length
      ? `<table class="grid"><thead><tr><th>Kupon</th><th>Üye</th><th>Kasada</th><th>Tarih</th></tr></thead><tbody>${redemptions.slice(0, 30).map((r) => `<tr><td class="code">${esc(r.code)}</td><td>${phoneText(r.phone)}</td><td>${esc(r.by)}${r.note ? `<br><span class="muted small-text">${esc(r.note)}</span>` : ""}</td><td class="muted small-text">${fmtDate(r.at)}</td></tr>`).join("")}</tbody></table>`
      : '<p class="empty">Henüz kupon kullanılmadı.</p>';
  };
  const find = async () => {
    out.innerHTML = "";
    const phone = $("#k-phone", panel).value;
    if (!ctx.can("members.view")) {
      out.innerHTML = `<div class="row" style="margin-top:12px"><label>Kupon kodu <input id="k-code" placeholder="örn. HOSGELDIN"></label><button type="button" class="primary" id="k-use">Kullan</button></div>`;
      $("#k-use", out).onclick = () => use({ code: $("#k-code", out).value });
      return;
    }
    let data;
    try { data = await ctx.api(`/api/admin/members?phone=${encodeURIComponent(phone)}`); } catch (e) { out.innerHTML = `<p class="error">${esc(e.message)}</p>`; return; }
    const m = data.member;
    out.innerHTML = `<div class="kasa-result"><b>${esc(m.name)}</b> · ${phoneText(m.phone)} ${m.disabled ? '<span class="pill off">üyelik durdurulmuş</span>' : ""}
      ${data.coupons.length ? data.coupons.map((c) => `
        <div class="coupon-card" style="margin-top:10px"><div><span class="code">${esc(c.code)}</span> · <b>${esc(c.title)}</b><br><span class="muted small-text">${COUPON_KINDS[c.kind](c.value)} · ${c.used}/${c.perMember} kullanıldı${c.validTo ? ` · son gün ${fmtDay(c.validTo)}` : ""}</span></div>
        <div>${c.usable ? `<button type="button" class="primary small" data-use="${esc(c.id)}">Kullan</button>` : '<span class="pill">kullanılamaz</span>'}</div></div>`).join("") : '<p class="muted">Bu üyenin geçerli kuponu yok.</p>'}
      <label>Not (isteğe bağlı) <input id="k-note" maxlength="120" placeholder="örn. 22 ayar bilezik, 15 gr"></label></div>`;
    $$("[data-use]", out).forEach((b) => (b.onclick = () => use({ couponId: b.dataset.use })));
  };
  const use = async (pick) => {
    const phone = $("#k-phone", panel).value;
    const note = $("#k-note", panel)?.value ?? "";
    if (!confirm("Kupon kullanıldı olarak işaretlensin mi? Bu işlem geri alınamaz.")) return;
    try {
      const r = await ctx.api("/api/admin/coupons", { method: "POST", body: JSON.stringify({ redeem: { ...pick, phone, note } }) });
      ctx.toast(`${r.coupon.code} kuponu ${r.member.name} için kullanıldı`);
      await find();
      await recent();
    } catch (e) {
      ctx.toast(e.message);
    }
  };
  $("#k-find", panel).onclick = find;
  $("#k-phone", panel).addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); find(); } });
  await recent();
}

// ---------- members ----------

async function members(panel) {
  panel.innerHTML = `
    <div class="card">
      <div class="card-head"><h2>Üyeler <span id="m-count" class="muted small-text"></span></h2><button type="button" class="ghost small" id="m-csv">Excel’e aktar (CSV)</button></div>
      <div class="row"><label>Ara <input id="m-q" type="search" placeholder="İsim, telefon veya etiket"></label>
        <label>Durum <select id="m-state"><option value="">Tümü</option><option value="active">Aktif</option><option value="disabled">Durdurulmuş</option><option value="new">Son 7 gün</option></select></label></div>
      <div id="m-list" style="margin-top:12px">Yükleniyor…</div>
    </div>
    <div id="m-detail"></div>`;
  const list = await loadMembers(true);
  const render = () => {
    const q = $("#m-q", panel).value.trim().toLocaleLowerCase("tr");
    const st = $("#m-state", panel).value;
    const week = new Date(Date.now() - 7 * 864e5).toISOString();
    const rows = list.filter((m) => (!q || `${m.name} ${m.phone} ${phoneText(m.phone)} ${(m.tags || []).join(" ")}`.toLocaleLowerCase("tr").includes(q))
      && (!st || (st === "active" && !m.disabled) || (st === "disabled" && m.disabled) || (st === "new" && m.createdAt >= week)));
    $("#m-count", panel).textContent = `${rows.length} / ${list.length}`;
    $("#m-list", panel).innerHTML = rows.length ? `<table class="grid"><thead><tr><th>Üye</th><th>Etiketler</th><th>Üyelik</th><th>Son giriş</th></tr></thead><tbody>${rows.map((m) => `
      <tr class="click" data-phone="${m.phone}"><td><b>${esc(m.name)}</b><br><span class="muted small-text">${phoneText(m.phone)}</span></td>
      <td>${(m.tags || []).map((t) => `<span class="pill tag">${esc(t)}</span>`).join("")}${m.disabled ? '<span class="pill off">durduruldu</span>' : ""}</td>
      <td class="muted small-text">${fmtDate(m.createdAt)}</td><td class="muted small-text">${fmtDate(m.lastSeen)}</td></tr>`).join("")}</tbody></table>`
      : `<p class="empty">${list.length ? "Aramaya uygun üye yok." : "Henüz üye yok. Üyeliği “Üye fiyatları” bölümünden açabilirsiniz."}</p>`;
    $$("tr[data-phone]", panel).forEach((tr) => (tr.onclick = () => memberDetail($("#m-detail", panel), tr.dataset.phone, () => members(panel))));
  };
  $("#m-q", panel).oninput = render;
  $("#m-state", panel).onchange = render;
  $("#m-csv", panel).onclick = () => {
    const lines = [["Ad Soyad", "Telefon", "Etiketler", "Durum", "Üyelik tarihi", "Son giriş"], ...list.map((m) => [m.name, phoneText(m.phone), (m.tags || []).join(" "), m.disabled ? "Durduruldu" : "Aktif", fmtDate(m.createdAt), fmtDate(m.lastSeen)])];
    const csv = "﻿" + lines.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = "mercan-uyeler.csv";
    a.click();
  };
  render();
}

async function memberDetail(box, phone, reload) {
  box.innerHTML = '<div class="card">Yükleniyor…</div>';
  const d = await ctx.api(`/api/admin/members?phone=${phone}`);
  const m = d.member;
  const edit = ctx.can("members.edit");
  box.innerHTML = `
    <div class="card form">
      <div class="card-head"><h2>${esc(m.name)} ${m.disabled ? '<span class="pill off">durduruldu</span>' : '<span class="pill on">aktif</span>'}</h2><button type="button" class="ghost small" data-close>Kapat</button></div>
      <p class="muted" style="margin-top:0">${phoneText(m.phone)} · üye ${fmtDate(m.createdAt)} · son giriş ${fmtDate(m.lastSeen)}</p>
      <label>Etiketler (virgülle) <input id="d-tags" value="${esc((m.tags || []).join(", "))}" placeholder="örn. VIP, düğün, toptan" ${edit ? "" : "disabled"}></label>
      <label>Not (yalnızca panelde görünür) <textarea id="d-note" rows="2" maxlength="500" ${edit ? "" : "disabled"}>${esc(m.note || "")}</textarea></label>
      ${edit ? `<div class="row"><button type="button" class="primary small" data-act="save">Etiket ve notu kaydet</button>
        <button type="button" class="ghost small" data-act="${m.disabled ? "enable" : "disable"}">${m.disabled ? "Üyeliği aç" : "Üyeliği durdur"}</button>
        <button type="button" class="ghost small" data-act="password">Yeni şifre ver</button>
        <button type="button" class="ghost small danger" data-act="delete">Üyeyi sil</button></div>` : ""}
      <h2 style="margin-top:18px">Kuponları</h2>
      ${d.coupons.length ? d.coupons.map((c) => `<div class="coupon-card"><div><span class="code">${esc(c.code)}</span> · ${esc(c.title)}<br><span class="muted small-text">${COUPON_KINDS[c.kind](c.value)} · ${c.used}/${c.perMember} kullanıldı</span></div><div>${c.usable ? '<span class="pill on">geçerli</span>' : '<span class="pill">kullanıldı / süresi doldu</span>'}</div></div>`).join("") : '<p class="muted">Bu üyeye tanımlı kupon yok.</p>'}
      <h2 style="margin-top:18px">Kupon geçmişi</h2>
      ${d.redemptions.length ? `<table class="grid"><tbody>${d.redemptions.map((r) => `<tr><td class="code">${esc(r.code)}</td><td>${esc(r.by)}${r.note ? ` · ${esc(r.note)}` : ""}</td><td class="muted small-text">${fmtDate(r.at)}</td></tr>`).join("")}</tbody></table>` : '<p class="muted">Henüz kupon kullanmadı.</p>'}
    </div>`;
  box.scrollIntoView({ behavior: "smooth" });
  $("[data-close]", box).onclick = () => (box.innerHTML = "");
  const act = async (action, extra = {}) => {
    try {
      const r = await ctx.api("/api/admin/members", { method: "POST", body: JSON.stringify({ phone: m.phone, action, ...extra }) });
      ctx.toast(r.deleted ? "Üye silindi" : "Kaydedildi");
      membersCache = null;
      if (r.deleted) { box.innerHTML = ""; reload(); } else memberDetail(box, phone, reload);
    } catch (e) { ctx.toast(e.message); }
  };
  $$("[data-act]", box).forEach((b) => (b.onclick = async () => {
    const a = b.dataset.act;
    if (a === "save") {
      await act("tags", { tags: $("#d-tags", box).value.split(",").map((t) => t.trim()).filter(Boolean) });
      await act("note", { note: $("#d-note", box).value });
    } else if (a === "password") {
      const pw = prompt("Üyenin yeni şifresi (en az 6 karakter). Üyeye bu şifreyi siz iletin:");
      if (pw) act("password", { password: pw });
    } else if (a === "delete") {
      if (confirm(`${m.name} ve tüm üyelik bilgileri silinsin mi? Geri alınamaz.`)) act("delete");
    } else act(a);
  }));
}

// ---------- member prices (saved with the config) ----------

const DEAL_CODES = ["ALTIN", "KULCEALTIN", "AYAR22", "AYAR14", "CEYREK_YENI", "CEYREK_ESKI", "YARIM_YENI", "YARIM_ESKI", "TEK_YENI", "TEK_ESKI", "ATA_YENI", "ATA5_YENI", "GREMESE_YENI", "GUMUSTRY", "USDTRY", "EURTRY"];

async function memberPrices(panel) {
  const cfg = ctx.getConfig();
  cfg.members ??= { enabled: false, note: "" };
  cfg.memberDeals ??= {};
  const name = (code) => {
    const p = ctx.catalog.find((x) => x.code === code);
    return p ? `${p.name}${p.variant && p.variant !== "Eski" ? ` (${p.variant})` : ""}` : code;
  };
  panel.innerHTML = `
    <div class="card form">
      <h2>Üyelik</h2>
      <label class="check"><input type="checkbox" id="mp-on" ${cfg.members.enabled ? "checked" : ""}> Üyelik açık (müşteriler web sitesinden ve uygulamadan üye olabilir)</label>
      <label>Üye olmayanlara gösterilecek kısa mesaj <input id="mp-note" maxlength="160" value="${esc(cfg.members.note || "")}" placeholder="örn. Üye olun, size özel fiyat ve kuponlardan yararlanın"></label>
    </div>
    <div class="card form">
      <h2>Üyelere özel fiyatlar</h2>
      <p class="muted">Giriş yapan üyeler, sitedeki fiyata göre <b>daha düşük satış</b> ve <b>daha yüksek alış</b> fiyatı görür. Boş bırakılan ürünlerde üye fiyatı normal fiyatla aynıdır. Değişiklikler “Kaydet” ile yayınlanır.</p>
      <div class="deal-row muted" style="font-weight:600"><span>Ürün</span><span>Satıştan düş</span><span>Alışa ekle</span><span>Birim</span><span>Üye fiyatı (şu an)</span></div>
      <div id="mp-rows"></div>
    </div>`;
  $("#mp-on", panel).onchange = (e) => { cfg.members.enabled = e.target.checked; ctx.onChange(); };
  $("#mp-note", panel).oninput = (e) => { cfg.members.note = e.target.value; ctx.onChange(); };
  const rows = $("#mp-rows", panel);
  rows.innerHTML = DEAL_CODES.filter((c) => ctx.catalog.some((p) => p.code === c)).map((code) => {
    const d = cfg.memberDeals[code] ?? {};
    return `<div class="deal-row" data-code="${code}"><span>${esc(name(code))}</span>
      <input data-f="sell" inputmode="decimal" placeholder="0" value="${d.sell || ""}">
      <input data-f="buy" inputmode="decimal" placeholder="0" value="${d.buy || ""}">
      <select data-f="unit"><option value="amount">₺</option><option value="percent">%</option></select>
      <span class="muted" data-preview></span></div>`;
  }).join("");
  const preview = (row) => {
    const code = row.dataset.code;
    const d = cfg.memberDeals[code];
    const q = ctx.priced(code);
    const el = $("[data-preview]", row);
    if (!q) { el.textContent = "fiyat bekleniyor"; return; }
    const pct = d?.unit === "percent";
    const sell = q.sell == null ? null : d?.sell ? (pct ? q.sell * (1 - d.sell / 100) : q.sell - d.sell) : q.sell;
    const buy = q.buy == null ? null : d?.buy ? (pct ? q.buy * (1 + d.buy / 100) : q.buy + d.buy) : q.buy;
    el.textContent = `alış ${buy == null ? "—" : money(buy)} · satış ${sell == null ? "—" : money(sell)}`;
  };
  for (const row of $$(".deal-row[data-code]", rows)) {
    const code = row.dataset.code;
    $('[data-f="unit"]', row).value = cfg.memberDeals[code]?.unit || "amount";
    row.addEventListener("input", () => {
      const v = (f) => Number(String($(`[data-f="${f}"]`, row).value).replace(",", ".")) || 0;
      const sell = v("sell"), buy = v("buy");
      if (sell || buy) cfg.memberDeals[code] = { sell, buy, unit: $('[data-f="unit"]', row).value };
      else delete cfg.memberDeals[code];
      ctx.onChange();
      preview(row);
    });
    preview(row);
  }
  panel._preview = () => $$(".deal-row[data-code]", rows).forEach(preview);
}

/** Live prices moved: refresh member price previews. */
export function refreshDealPreviews() {
  $('[data-panel="memberPrices"]')?._preview?.();
}

// ---------- coupons ----------

async function coupons(panel) {
  panel.innerHTML = '<div class="card">Yükleniyor…</div>';
  const [{ coupons: list, redemptions }, memberList] = await Promise.all([ctx.api("/api/admin/coupons"), ctx.can("members.view") ? loadMembers() : []]);
  const usedOf = (id) => redemptions.filter((r) => r.couponId === id).length;
  const today = new Date().toISOString().slice(0, 10);
  const state = (c) => !c.active ? '<span class="pill off">pasif</span>' : c.validTo && c.validTo < today ? '<span class="pill">süresi doldu</span>' : c.validFrom && c.validFrom > today ? '<span class="pill">başlamadı</span>' : '<span class="pill on">geçerli</span>';
  panel.innerHTML = `
    <div class="card"><div class="card-head"><h2>Kuponlar <span class="muted small-text">${list.length}</span></h2><button type="button" class="primary small" id="c-new">+ Yeni kupon</button></div>
      <p class="muted">Kuponlar üyelerin web sitesi ve uygulamadaki “Kuponlarım” bölümünde görünür. Müşteri kasada kodu gösterir, siz “Kasa” bölümünden kullanıldı olarak işaretlersiniz.</p>
      <div id="c-edit"></div>
      ${list.length ? list.map((c) => `<div class="coupon-card"><div><span class="code">${esc(c.code)}</span> · <b>${esc(c.title)}</b> ${state(c)}<br>
        <span class="muted small-text">${COUPON_KINDS[c.kind](c.value)} · ${c.audience === "all" ? "tüm üyeler" : `${c.members.length} seçili üye`} · üye başına ${c.perMember} kez${c.totalLimit ? ` · toplam ${c.totalLimit}` : ""} · ${usedOf(c.id)} kez kullanıldı${c.validFrom || c.validTo ? ` · ${fmtDay(c.validFrom) || "…"} – ${fmtDay(c.validTo) || "…"}` : ""}</span>
        ${c.description ? `<br><span class="small-text">${esc(c.description)}</span>` : ""}</div>
        <div class="row" style="align-items:center"><button type="button" class="ghost small" data-edit="${c.id}">Düzenle</button><button type="button" class="ghost small danger" data-del="${c.id}">Sil</button></div></div>`).join("") : '<p class="empty">Henüz kupon yok. “+ Yeni kupon” ile başlayın.</p>'}
    </div>`;
  const editor = (c = { kind: "percent", audience: "all", perMember: 1, active: true }) => {
    const box = $("#c-edit", panel);
    const selected = new Set(c.members || []);
    box.innerHTML = `<div class="card form" style="border-color:var(--gold)">
      <h2>${c.id ? "Kuponu düzenle" : "Yeni kupon"}</h2>
      <div class="row"><label>Başlık <input id="e-title" maxlength="60" value="${esc(c.title || "")}" placeholder="örn. Hoş geldin indirimi"></label>
        <label>Kupon kodu <input id="e-code" maxlength="20" value="${esc(c.code || "")}" placeholder="Boş bırakılırsa otomatik"></label></div>
      <div class="row"><label>Tür <select id="e-kind"><option value="percent">Yüzde indirim (%)</option><option value="amount">Tutar indirimi (₺)</option><option value="gram">Gram başına indirim (₺/gr)</option><option value="gift">Hediye / özel teklif</option></select></label>
        <label>Değer <input id="e-value" inputmode="decimal" value="${c.value ?? ""}"></label>
        <label>Üye başına kullanım <input id="e-per" type="number" min="1" max="100" value="${c.perMember || 1}"></label>
        <label>Toplam sınır (0 = sınırsız) <input id="e-total" type="number" min="0" value="${c.totalLimit || 0}"></label></div>
      <div class="row"><label>Başlangıç <input id="e-from" type="date" value="${c.validFrom || ""}"></label><label>Bitiş <input id="e-to" type="date" value="${c.validTo || ""}"></label></div>
      <label>Açıklama (üyeler görür) <textarea id="e-desc" rows="2" maxlength="300" placeholder="örn. 22 ayar bileziklerde işçilikte geçerlidir.">${esc(c.description || "")}</textarea></label>
      <label>Kimler görsün <select id="e-aud"><option value="all">Tüm üyeler</option><option value="selected">Seçtiğim üyeler</option></select></label>
      <div id="e-pick" hidden>${ctx.can("members.view") ? `<input id="e-find" type="search" placeholder="Üye ara"><div class="picker">${memberList.map((m) => `<label class="check" data-n="${esc(`${m.name} ${m.phone} ${(m.tags || []).join(" ")}`.toLocaleLowerCase("tr"))}"><input type="checkbox" value="${m.phone}" ${selected.has(m.phone) ? "checked" : ""}> ${esc(m.name)} <span class="muted small-text">${phoneText(m.phone)}</span></label>`).join("") || '<p class="muted">Üye yok.</p>'}</div>` : '<p class="muted">Üye seçmek için “Üyeleri görüntüleme” yetkisi gerekir.</p>'}</div>
      <label class="check"><input type="checkbox" id="e-active" ${c.active !== false ? "checked" : ""}> Kupon aktif</label>
      <div class="row"><button type="button" class="primary" id="e-save">Kaydet</button><button type="button" class="ghost" id="e-cancel">Vazgeç</button></div>
      <p class="error" id="e-err"></p></div>`;
    $("#e-kind", box).value = c.kind;
    $("#e-aud", box).value = c.audience;
    const sync = () => {
      $("#e-pick", box).hidden = $("#e-aud", box).value !== "selected";
      $("#e-value", box).disabled = $("#e-kind", box).value === "gift";
    };
    $("#e-aud", box).onchange = sync;
    $("#e-kind", box).onchange = sync;
    sync();
    $("#e-find", box)?.addEventListener("input", (e) => {
      const q = e.target.value.toLocaleLowerCase("tr");
      $$(".picker label", box).forEach((l) => (l.hidden = q && !l.dataset.n.includes(q)));
    });
    $("#e-cancel", box).onclick = () => (box.innerHTML = "");
    $("#e-save", box).onclick = async () => {
      const coupon = {
        id: c.id, title: $("#e-title", box).value, code: $("#e-code", box).value, kind: $("#e-kind", box).value,
        value: $("#e-value", box).value, perMember: $("#e-per", box).value, totalLimit: $("#e-total", box).value,
        validFrom: $("#e-from", box).value, validTo: $("#e-to", box).value, description: $("#e-desc", box).value,
        audience: $("#e-aud", box).value, members: $$(".picker input:checked", box).map((i) => i.value), active: $("#e-active", box).checked,
      };
      try {
        await ctx.api("/api/admin/coupons", { method: "PUT", body: JSON.stringify({ coupon }) });
        ctx.toast("Kupon kaydedildi");
        coupons(panel);
      } catch (e) { $("#e-err", box).textContent = e.message; }
    };
    box.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  $("#c-new", panel).onclick = () => editor();
  $$("[data-edit]", panel).forEach((b) => (b.onclick = () => editor(list.find((c) => c.id === b.dataset.edit))));
  $$("[data-del]", panel).forEach((b) => (b.onclick = async () => {
    const c = list.find((x) => x.id === b.dataset.del);
    if (!confirm(`“${c.title}” kuponu silinsin mi? Üyelerin listesinden de kalkar.`)) return;
    try { await ctx.api(`/api/admin/coupons?id=${c.id}`, { method: "DELETE" }); ctx.toast("Kupon silindi"); coupons(panel); } catch (e) { ctx.toast(e.message); }
  }));
}

// ---------- notifications ----------

async function notify(panel) {
  panel.innerHTML = '<div class="card">Yükleniyor…</div>';
  const [{ notices }, memberList] = await Promise.all([ctx.api("/api/admin/notices"), ctx.can("members.view") ? loadMembers() : []]);
  const tags = [...new Set(memberList.flatMap((m) => m.tags || []))];
  panel.innerHTML = `
    <div class="card form">
      <h2>Yeni bildirim</h2>
      <p class="muted">Bildirim, üyelerin web sitesi ve uygulamadaki “Bildirimlerim” kutusuna düşer; okunmamış bildirim sayısı rozetle gösterilir.</p>
      <label>Başlık <input id="n-title" maxlength="80" placeholder="örn. Hafta sonu işçiliksiz bilezik"></label>
      <label>Mesaj <textarea id="n-body" rows="4" maxlength="1000"></textarea></label>
      <label>Bağlantı (isteğe bağlı) <input id="n-link" placeholder="https://mercankuyumculukosmaniye.com.tr/koleksiyon/"></label>
      <label>Kime <select id="n-aud"><option value="all">Tüm üyeler (${memberList.length || "hepsi"})</option><option value="selected">Seçtiğim üyeler</option></select></label>
      <div id="n-pick" hidden>
        ${tags.length ? `<div class="row" style="margin-bottom:6px">${tags.map((t) => `<button type="button" class="ghost small" data-tag="${esc(t)}">${esc(t)} etiketlileri seç</button>`).join("")}</div>` : ""}
        <input id="n-find" type="search" placeholder="Üye ara">
        <div class="picker">${memberList.map((m) => `<label class="check" data-n="${esc(`${m.name} ${m.phone}`.toLocaleLowerCase("tr"))}" data-tags="${esc((m.tags || []).join("|"))}"><input type="checkbox" value="${m.phone}"> ${esc(m.name)} <span class="muted small-text">${phoneText(m.phone)}</span></label>`).join("") || '<p class="muted">Üye yok.</p>'}</div>
      </div>
      <div class="row"><button type="button" class="primary" id="n-send">Gönder</button><span class="muted small-text" id="n-count"></span></div>
      <p class="error" id="n-err"></p>
    </div>
    <div class="card"><h2>Gönderilenler</h2>
      ${notices.length ? notices.map((n) => `<div class="coupon-card"><div><b>${esc(n.title)}</b> <span class="muted small-text">· ${n.audience === "all" ? "tüm üyeler" : `${n.members.length} üye`} · ${esc(n.by)} · ${fmtDate(n.at)}</span><br><span class="small-text">${esc(n.body)}</span></div><div><button type="button" class="ghost small danger" data-del="${n.id}">Geri çek</button></div></div>`).join("") : '<p class="empty">Henüz bildirim gönderilmedi.</p>'}
    </div>`;
  const count = () => { $("#n-count", panel).textContent = $("#n-aud", panel).value === "selected" ? `${$$(".picker input:checked", panel).length} üye seçili` : ""; };
  $("#n-aud", panel).onchange = () => { $("#n-pick", panel).hidden = $("#n-aud", panel).value !== "selected"; count(); };
  panel.addEventListener("change", count);
  $("#n-find", panel)?.addEventListener("input", (e) => {
    const q = e.target.value.toLocaleLowerCase("tr");
    $$(".picker label", panel).forEach((l) => (l.hidden = q && !l.dataset.n.includes(q)));
  });
  $$("[data-tag]", panel).forEach((b) => (b.onclick = () => {
    $$(".picker label", panel).forEach((l) => { if (l.dataset.tags.split("|").includes(b.dataset.tag)) $("input", l).checked = true; });
    count();
  }));
  $("#n-send", panel).onclick = async () => {
    const body = { title: $("#n-title", panel).value, body: $("#n-body", panel).value, link: $("#n-link", panel).value, audience: $("#n-aud", panel).value, members: $$(".picker input:checked", panel).map((i) => i.value) };
    if (!confirm(`Bildirim ${body.audience === "all" ? "tüm üyelere" : `${body.members.length} üyeye`} gönderilsin mi?`)) return;
    try { await ctx.api("/api/admin/notices", { method: "POST", body: JSON.stringify(body) }); ctx.toast("Bildirim gönderildi"); notify(panel); } catch (e) { $("#n-err", panel).textContent = e.message; }
  };
  $$("[data-del]", panel).forEach((b) => (b.onclick = async () => {
    if (!confirm("Bu bildirim üyelerin kutusundan kaldırılsın mı?")) return;
    try { await ctx.api(`/api/admin/notices?id=${b.dataset.del}`, { method: "DELETE" }); notify(panel); } catch (e) { ctx.toast(e.message); }
  }));
}

// ---------- staff ----------

async function staff(panel) {
  panel.innerHTML = '<div class="card">Yükleniyor…</div>';
  const { staff: list, permissions } = await ctx.api("/api/admin/staff");
  panel.innerHTML = `
    <div class="card"><div class="card-head"><h2>Personel ve yetkiler</h2><button type="button" class="primary small" id="s-new">+ Personel ekle</button></div>
      <p class="muted">Her personel kendi kullanıcı adı ve şifresiyle girer; yalnızca işaretlediğiniz bölümleri görür ve değiştirebilir. Yetki değiştirdiğinizde ya da hesabı pasif yaptığınızda açık oturumu hemen kapanır. Mağaza sahibi (şifreyle giren) her şeyi yapabilir.</p>
      <div id="s-edit"></div>
      ${list.length ? `<table class="grid"><thead><tr><th>Personel</th><th>Yetkiler</th><th>Son giriş</th><th></th></tr></thead><tbody>${list.map((s) => `
        <tr><td><b>${esc(s.name)}</b><br><span class="muted small-text">${esc(s.username)}</span> ${s.active ? "" : '<span class="pill off">pasif</span>'}</td>
        <td>${s.perms.map((p) => `<span class="pill tag">${esc(permissions[p] ?? p)}</span>`).join("") || '<span class="muted">yetki yok</span>'}</td>
        <td class="muted small-text">${fmtDate(s.lastLogin)}</td>
        <td><button type="button" class="ghost small" data-edit="${esc(s.username)}">Düzenle</button> <button type="button" class="ghost small danger" data-del="${esc(s.username)}">Sil</button></td></tr>`).join("")}</tbody></table>` : '<p class="empty">Henüz personel yok.</p>'}
    </div>`;
  const PRESETS = {
    "Kasa görevlisi": ["dashboard", "coupons.redeem", "members.view"],
    "Fiyat sorumlusu": ["dashboard", "prices", "memberPrices"],
    "Pazarlama": ["dashboard", "site", "coupons", "notify", "members.view"],
    "Müdür (sahip hariç her şey)": Object.keys(permissions),
  };
  const editor = (s) => {
    const box = $("#s-edit", panel);
    const perms = new Set(s?.perms ?? ["dashboard"]);
    box.innerHTML = `<div class="card form" style="border-color:var(--gold)">
      <h2>${s ? `${esc(s.name)} düzenle` : "Yeni personel"}</h2>
      <div class="row"><label>Ad soyad <input id="p-name" maxlength="60" value="${esc(s?.name || "")}"></label>
        <label>Kullanıcı adı <input id="p-user" maxlength="30" value="${esc(s?.username || "")}" ${s ? "disabled" : ""} placeholder="örn. ayse"></label>
        <label>${s ? "Yeni şifre (değişmeyecekse boş)" : "Şifre (en az 8 karakter)"} <input id="p-pass" type="text" autocomplete="new-password"></label></div>
      <p class="muted small-text">Hazır yetki setleri: ${Object.keys(PRESETS).map((k) => `<button type="button" class="ghost small" data-preset="${esc(k)}">${esc(k)}</button>`).join(" ")}</p>
      <div class="perm-grid">${Object.entries(permissions).map(([k, v]) => `<label class="check"><input type="checkbox" value="${k}" ${perms.has(k) ? "checked" : ""}> ${esc(v)}</label>`).join("")}</div>
      <label class="check"><input type="checkbox" id="p-active" ${s?.active === false ? "" : "checked"}> Hesap aktif</label>
      <div class="row"><button type="button" class="primary" id="p-save">Kaydet</button><button type="button" class="ghost" id="p-cancel">Vazgeç</button></div>
      <p class="error" id="p-err"></p></div>`;
    $$("[data-preset]", box).forEach((b) => (b.onclick = () => {
      const set = new Set(PRESETS[b.dataset.preset]);
      $$(".perm-grid input", box).forEach((i) => (i.checked = set.has(i.value)));
    }));
    $("#p-cancel", box).onclick = () => (box.innerHTML = "");
    $("#p-save", box).onclick = async () => {
      const body = { staff: { create: !s, username: s?.username ?? $("#p-user", box).value, name: $("#p-name", box).value, password: $("#p-pass", box).value, perms: $$(".perm-grid input:checked", box).map((i) => i.value), active: $("#p-active", box).checked } };
      try { await ctx.api("/api/admin/staff", { method: "PUT", body: JSON.stringify(body) }); ctx.toast("Personel kaydedildi"); staff(panel); } catch (e) { $("#p-err", box).textContent = e.message; }
    };
    box.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  $("#s-new", panel).onclick = () => editor(null);
  $$("[data-edit]", panel).forEach((b) => (b.onclick = () => editor(list.find((s) => s.username === b.dataset.edit))));
  $$("[data-del]", panel).forEach((b) => (b.onclick = async () => {
    if (!confirm(`${b.dataset.del} kullanıcısı silinsin mi?`)) return;
    try { await ctx.api(`/api/admin/staff?username=${encodeURIComponent(b.dataset.del)}`, { method: "DELETE" }); staff(panel); } catch (e) { ctx.toast(e.message); }
  }));
}

// ---------- activity log ----------

async function logs(panel) {
  panel.innerHTML = '<div class="card">Yükleniyor…</div>';
  const { log } = await ctx.api("/api/admin/log");
  const people = [...new Set(log.map((l) => l.by))];
  panel.innerHTML = `<div class="card"><h2>İşlem geçmişi</h2>
    <p class="muted">Panelde kimin ne yaptığı (son 500 işlem).</p>
    <div class="row"><label>Kişi <select id="l-who"><option value="">Herkes</option>${people.map((p) => `<option>${esc(p)}</option>`).join("")}</select></label><label>Ara <input id="l-q" type="search"></label></div>
    <div id="l-list" style="margin-top:10px"></div></div>`;
  const render = () => {
    const who = $("#l-who", panel).value, q = $("#l-q", panel).value.toLocaleLowerCase("tr");
    const rows = log.filter((l) => (!who || l.by === who) && (!q || `${l.action} ${l.detail}`.toLocaleLowerCase("tr").includes(q)));
    $("#l-list", panel).innerHTML = rows.length ? `<table class="grid"><thead><tr><th>Zaman</th><th>Kişi</th><th>İşlem</th></tr></thead><tbody>${rows.map((l) => `<tr><td class="muted small-text">${fmtDate(l.at)}</td><td>${esc(l.by)}</td><td>${esc(l.action)}${l.detail ? `<br><span class="muted small-text">${esc(l.detail)}</span>` : ""}</td></tr>`).join("")}</tbody></table>` : '<p class="empty">Kayıt yok.</p>';
  };
  $("#l-who", panel).onchange = render;
  $("#l-q", panel).oninput = render;
  render();
}
