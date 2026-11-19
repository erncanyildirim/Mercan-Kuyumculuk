// /uye/: sign in or sign up; members see their coupons, messages, member prices and account.
import { esc, fmt, loadCatalog, loadConfig, memberApi, productName, setMemberToken, siteDecimals, startLive } from "./live.js?v=202611191200";
import { siteContent } from "./site-defaults.js?v=202611191200";
import { initChrome } from "./chrome.js?v=202611191200";

const [config, catalog] = await Promise.all([loadConfig(), loadCatalog()]);
initChrome({ config, site: siteContent(config), current: "member" });
const view = document.getElementById("view");
let data = config.member; // null when signed out
let tab = new URLSearchParams(location.search).get("t") || "coupons";
let quotes = new Map();
let stopLive = null;

const KIND = {
  percent: (v) => `%${fmt(v, v % 1 ? 1 : 0)} indirim`,
  amount: (v) => `${fmt(v, 0)} ₺ indirim`,
  gram: (v) => `Gram başına ${fmt(v, 0)} ₺ indirim`,
  gift: () => "Size özel hediye",
};
const day = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }) : "");
const when = (iso) => new Date(iso).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" });

function render() {
  if (!data) return renderAuth(config.members?.enabled ? "login" : "closed");
  renderAccount();
}

// ---------- sign in / sign up ----------

function renderAuth(mode) {
  if (mode === "closed") {
    view.innerHTML = `<div class="auth"><h2>Üyelik yakında</h2><p>Üyelik şu anda kapalı. Kampanyalardan haberdar olmak için bizi Instagram’dan takip edebilir ya da WhatsApp’tan yazabilirsiniz.</p>
      <p style="margin:0">Zaten üyeyseniz giriş yapabilirsiniz.</p><div class="switch"><button type="button" data-mode="login">Giriş yap</button></div></div>`;
    view.querySelector("[data-mode]").onclick = () => renderAuth("login");
    return;
  }
  const signup = mode === "signup";
  view.innerHTML = `<form class="auth" novalidate>
    <h2>${signup ? "Üye olun" : "Üye girişi"}</h2>
    <p>${signup ? "Üyelere özel fiyatlar, kuponlar ve kampanya bildirimleri için ücretsiz üye olun." : esc(config.members?.note || "Üyelere özel fiyat ve kuponlarınızı görmek için giriş yapın.")}</p>
    ${signup ? '<label class="field">Ad soyad <input name="name" autocomplete="name" required maxlength="60"></label>' : ""}
    <label class="field">Cep telefonu <input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="05XX XXX XX XX" required></label>
    <label class="field">Şifre <input name="password" type="password" autocomplete="${signup ? "new-password" : "current-password"}" required minlength="6"></label>
    ${signup ? '<p style="font-size:12.5px;margin:-4px 0 14px">Üye olarak bilgilerinizin yalnızca Mercan Kuyumculuk tarafından üyelik için kullanılmasını kabul edersiniz. <a href="/gizlilik/" style="color:var(--gold)">Gizlilik politikası</a></p>' : ""}
    <p class="err" role="alert"></p>
    <button class="btn" type="submit" style="width:100%">${signup ? "Üye ol" : "Giriş yap"}</button>
    <div class="switch">${signup ? 'Zaten üye misiniz? <button type="button" data-mode="login">Giriş yapın</button>' : config.members?.enabled ? 'Hesabınız yok mu? <button type="button" data-mode="signup">Üye olun</button>' : ""}</div>
    ${signup ? "" : '<p style="text-align:center;font-size:12.5px;margin:12px 0 0">Şifrenizi unuttuysanız mağazamıza yazın, yeni şifre verelim.</p>'}
  </form>`;
  const form = view.querySelector("form");
  view.querySelector("[data-mode]")?.addEventListener("click", (e) => renderAuth(e.target.dataset.mode));
  form.onsubmit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(form));
    form.querySelector(".err").textContent = "";
    form.querySelector("button[type=submit]").disabled = true;
    try {
      data = await memberApi(signup ? "/api/member/register" : "/api/member/login", { method: "POST", body: f });
      location.reload(); // re-render header and prices as a member
    } catch (err) {
      form.querySelector(".err").textContent = err.message;
      form.querySelector("button[type=submit]").disabled = false;
    }
  };
}

// ---------- account ----------

function renderAccount() {
  const first = data.member.name.split(" ")[0];
  const tabs = [["coupons", `Kuponlarım${data.coupons.filter((c) => c.usable).length ? ` (${data.coupons.filter((c) => c.usable).length})` : ""}`], ["messages", `Bildirimler${data.unread ? ` <span class="badge">${data.unread}</span>` : ""}`], ["prices", "Üye fiyatları"], ["account", "Hesabım"]];
  view.innerHTML = `
    <div class="acc-head"><div><h1>Merhaba, <em class="gold">${esc(first)}</em></h1></div></div>
    <div class="tabs acc-tabs" role="tablist">${tabs.map(([k, t]) => `<button type="button" data-tab="${k}" aria-selected="${k === tab}">${t}</button>`).join("")}</div>
    <div class="panel" id="panel"></div>`;
  view.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { tab = b.dataset.tab; history.replaceState(null, "", `?t=${tab}`); renderAccount(); }));
  const panel = document.getElementById("panel");
  ({ coupons, messages, prices, account })[tab]?.(panel);
}

function coupons(panel) {
  panel.innerHTML = data.coupons.length
    ? `<p style="margin:0 0 16px;color:var(--muted)">Kuponunuzu kullanmak için kasada kodu gösterin ya da telefon numaranızı söyleyin.</p>` +
      data.coupons.map((c) => `<div class="coupon ${c.usable ? "" : "used"}"><div><h3>${esc(c.title)}</h3>
        <div class="meta">${KIND[c.kind](c.value)}${c.validTo ? ` · son gün ${day(c.validTo)}` : ""}${c.validFrom && !c.usable && c.used < c.perMember ? ` · ${day(c.validFrom)} itibarıyla` : ""}${c.perMember > 1 ? ` · ${c.used}/${c.perMember} kullanıldı` : c.used ? " · kullanıldı" : ""}</div>
        ${c.description ? `<p style="margin:8px 0 0;font-size:14px">${esc(c.description)}</p>` : ""}</div>
        <div class="code">${esc(c.code)}</div></div>`).join("")
    : '<p class="empty">Şu anda size tanımlı kupon yok. Yeni kuponlar burada ve bildirimlerinizde görünecek.</p>';
}

async function messages(panel) {
  panel.innerHTML = data.notices.length
    ? data.notices.map((n) => `<div class="msg"><h3>${n.read ? "" : '<span class="new" aria-label="yeni"></span>'}${esc(n.title)}</h3><p>${esc(n.body)}</p>
        ${n.link ? `<p><a class="link" href="${esc(n.link)}" target="_blank" rel="noopener">Detaylar →</a></p>` : ""}<time>${when(n.at)}</time></div>`).join("")
    : '<p class="empty">Henüz bildiriminiz yok.</p>';
  if (data.unread) {
    try { data = await memberApi("/api/member/me", { method: "POST", body: { read: true } }); } catch {}
    const b = view.querySelector('[data-tab="messages"]');
    if (b) b.textContent = "Bildirimler";
  }
}

function prices(panel) {
  const codes = Object.keys(data.deals || {});
  if (!codes.length) {
    panel.innerHTML = '<p class="empty">Şu anda üyelere özel fiyat tanımlı değil. Sitedeki tüm fiyatlar size de geçerli.</p>';
    return;
  }
  const draw = () => {
    panel.innerHTML = `<p style="margin:0 0 12px;color:var(--muted)">Giriş yaptığınız sürece sitedeki fiyatlar size bu üye fiyatlarıyla gösterilir.</p>
      <table class="ptable deals"><thead><tr><th>Ürün</th><th>Alış</th><th>Üye satış</th></tr></thead><tbody>${codes.map((code) => {
        const p = catalog.get(code), q = quotes.get(code), d = siteDecimals(p);
        return `<tr><td><span class="name">${esc(productName(p) || code)}</span></td><td>${q ? fmt(q.buy, d) : "—"}</td><td class="member">${q ? fmt(q.sell, d) : "—"}</td></tr>`;
      }).join("")}</tbody></table>`;
  };
  draw();
  stopLive ??= startLive({ config, onUpdate: (q) => { quotes = q; if (tab === "prices") draw(); } });
}

function account(panel) {
  panel.innerHTML = `
    <form id="f-name"><label class="field">Ad soyad <input name="name" value="${esc(data.member.name)}" maxlength="60"></label><button class="btn line small">Adımı kaydet</button></form>
    <hr style="border:0;border-top:1px solid var(--line);margin:22px 0">
    <form id="f-pass"><label class="field">Mevcut şifre <input name="oldPassword" type="password" autocomplete="current-password"></label>
      <label class="field">Yeni şifre <input name="password" type="password" autocomplete="new-password" minlength="6"></label><button class="btn line small">Şifremi değiştir</button></form>
    <p class="err" id="acc-err" style="margin-top:12px"></p>
    <div class="acc-actions"><button class="btn" id="logout" type="button">Çıkış yap</button><button class="btn line" id="delete" type="button">Üyeliğimi sil</button></div>
    <p style="font-size:12.5px;color:var(--muted);margin-top:14px">Telefon: ${esc(data.member.phone.replace(/^90/, "0"))} · üyelik ${day(data.member.createdAt.slice(0, 10))}</p>`;
  const err = panel.querySelector("#acc-err");
  const ok = (t) => { err.style.color = "var(--up)"; err.textContent = t; };
  const fail = (e) => { err.style.color = ""; err.textContent = e.message; };
  panel.querySelector("#f-name").onsubmit = async (e) => {
    e.preventDefault();
    try { data = await memberApi("/api/member/me", { method: "PUT", body: { name: e.target.name.value } }); ok("Adınız kaydedildi"); } catch (x) { fail(x); }
  };
  panel.querySelector("#f-pass").onsubmit = async (e) => {
    e.preventDefault();
    try { data = await memberApi("/api/member/me", { method: "PUT", body: { oldPassword: e.target.oldPassword.value, password: e.target.password.value } }); e.target.reset(); ok("Şifreniz değiştirildi"); } catch (x) { fail(x); }
  };
  panel.querySelector("#logout").onclick = () => { setMemberToken(null); location.href = "/"; };
  panel.querySelector("#delete").onclick = async () => {
    const pw = prompt("Üyeliğiniz ve tüm bilgileriniz kalıcı olarak silinecek. Onaylamak için şifrenizi yazın:");
    if (!pw) return;
    try { await memberApi("/api/member/me", { method: "DELETE", body: { password: pw } }); setMemberToken(null); alert("Üyeliğiniz silindi."); location.href = "/"; } catch (x) { fail(x); }
  };
}

render();
