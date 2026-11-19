import assert from "node:assert/strict";
import { test } from "node:test";

import * as adminConfig from "../functions/api/admin/config.js";
import * as coupons from "../functions/api/admin/coupons.js";
import * as login from "../functions/api/admin/login.js";
import * as members from "../functions/api/admin/members.js";
import * as notices from "../functions/api/admin/notices.js";
import * as staff from "../functions/api/admin/staff.js";
import * as publicConfig from "../functions/api/config.js";
import * as me from "../functions/api/member/me.js";
import * as register from "../functions/api/member/register.js";

class MemoryKV {
  map = new Map();
  meta = new Map();
  async get(k) { return this.map.get(k) ?? null; }
  async put(k, v, o) { this.map.set(k, v); this.meta.set(k, o?.metadata); }
  async delete(k) { this.map.delete(k); }
  async list({ prefix }) {
    return { keys: [...this.map.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name, metadata: this.meta.get(name) })), list_complete: true };
  }
}

const mkEnv = () => ({ CONFIG: new MemoryKV(), ADMIN_PASSWORD: "dogru-sifre-123", SESSION_SECRET: "s" });
function req(path, { method = "GET", body, token } = {}) {
  const h = new Headers();
  if (token) h.set("Authorization", `Bearer ${token}`);
  if (body !== undefined) h.set("Content-Type", "application/json");
  return new Request(`https://x.test${path}`, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
}
const call = async (mod, fn, env, path, opts) => {
  const res = await mod[fn]({ request: req(path, opts), env, params: {} });
  return { status: res.status, body: await res.json().catch(() => null) };
};

async function ownerToken(env) {
  return (await call(login, "onRequestPost", env, "/api/admin/login", { method: "POST", body: { password: "dogru-sifre-123" } })).body.token;
}

test("staff only change the parts they are allowed to", async () => {
  const env = mkEnv();
  const owner = await ownerToken(env);
  await call(adminConfig, "onRequestPut", env, "/a", { method: "PUT", token: owner, body: { products: { ALTIN: { mode: "adjust", sellAdj: 10 } }, store: { name: "Mercan" } } });
  const made = await call(staff, "onRequestPut", env, "/a", { method: "PUT", token: owner, body: { staff: { username: "ayse", name: "Ayşe", password: "kasa-sifre-1", perms: ["store"], create: true } } });
  assert.equal(made.status, 200);
  const t = (await call(login, "onRequestPost", env, "/l", { method: "POST", body: { username: "ayse", password: "kasa-sifre-1" } })).body.token;
  assert.ok(t);
  const cur = (await call(adminConfig, "onRequestGet", env, "/a", { token: t })).body;
  const saved = await call(adminConfig, "onRequestPut", env, "/a", { method: "PUT", token: t, body: { ...cur, products: {}, store: { ...cur.store, name: "Yeni Ad" } } });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.products.ALTIN.sellAdj, 10, "prices kept: no permission");
  assert.equal(saved.body.store.name, "Yeni Ad", "store changed: has permission");
  assert.equal((await call(staff, "onRequestGet", env, "/a", { token: t })).status, 403);
  // Deactivating the account ends the session at once.
  await call(staff, "onRequestPut", env, "/a", { method: "PUT", token: owner, body: { staff: { username: "ayse", perms: ["store"], active: false } } });
  assert.equal((await call(adminConfig, "onRequestGet", env, "/a", { token: t })).status, 401);
});

test("members get deals, coupons and messages; public config hides deals", async () => {
  const env = mkEnv();
  const owner = await ownerToken(env);
  await call(adminConfig, "onRequestPut", env, "/a", { method: "PUT", token: owner, body: { members: { enabled: true }, memberDeals: { AYAR22: { sell: 25, buy: 0, unit: "amount" } } } });
  const pub = await publicConfig.onRequestGet({ request: req("/api/config"), env });
  assert.equal((await pub.json()).memberDeals, undefined);

  const reg = await call(register, "onRequestPost", env, "/r", { method: "POST", body: { name: "Ali Veli", phone: "0532 111 22 33", password: "123456" } });
  assert.equal(reg.status, 201);
  assert.equal(reg.body.deals.AYAR22.sell, 25);

  const c = await call(coupons, "onRequestPut", env, "/c", { method: "PUT", token: owner, body: { coupon: { title: "Hoş geldin", kind: "percent", value: 10, code: "hosgeldin" } } });
  assert.equal(c.body.coupon.code, "HOSGELDIN");
  await call(notices, "onRequestPost", env, "/n", { method: "POST", token: owner, body: { title: "Kampanya", body: "Bu hafta işçilik yok" } });

  let mine = await call(me, "onRequestGet", env, "/m", { token: reg.body.token });
  assert.equal(mine.body.coupons.length, 1);
  assert.equal(mine.body.unread, 1);

  const used = await call(coupons, "onRequestPost", env, "/c", { method: "POST", token: owner, body: { redeem: { code: "hosgeldin", phone: "05321112233" } } });
  assert.equal(used.status, 200);
  const again = await call(coupons, "onRequestPost", env, "/c", { method: "POST", token: owner, body: { redeem: { code: "HOSGELDIN", phone: "05321112233" } } });
  assert.equal(again.status, 400, "per-member limit");

  mine = await call(me, "onRequestPost", env, "/m", { method: "POST", token: reg.body.token, body: { read: true } });
  assert.equal(mine.body.unread, 0);
  assert.equal(mine.body.coupons[0].usable, false);

  const list = await call(members, "onRequestGet", env, "/m", { token: owner });
  assert.equal(list.body.members.length, 1);
  await call(members, "onRequestPost", env, "/m", { method: "POST", token: owner, body: { phone: "905321112233", action: "disable" } });
  assert.equal((await call(me, "onRequestGet", env, "/m", { token: reg.body.token })).status, 401);
});
