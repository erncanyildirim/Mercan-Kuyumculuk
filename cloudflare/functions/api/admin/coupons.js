// GET    /api/admin/coupons            -> {coupons, redemptions}   (coupons or coupons.redeem)
// PUT    /api/admin/coupons {coupon}   -> {coupon}                 (coupons)
// DELETE /api/admin/coupons?id=...                                 (coupons)
// POST   /api/admin/coupons {redeem: {couponId|code, phone, note}} (coupons.redeem): use at the till
import { json } from "../../_lib/config.js";
import { deleteCoupon, listCoupons, listRedemptions, redeemCoupon, saveCoupon } from "../../_lib/loyalty.js";
import { getMember, normalizePhone } from "../../_lib/members.js";
import { AdminError, adminHandler, audit } from "../../_lib/staff.js";

export const onRequestGet = adminHandler(["coupons", "coupons.redeem"], async ({ env }) =>
  json({ coupons: await listCoupons(env), redemptions: (await listRedemptions(env)).slice(0, 500) }));

export const onRequestPut = adminHandler("coupons", async ({ request, env, user }) => {
  const body = await request.json().catch(() => ({}));
  const coupon = await saveCoupon(env, body.coupon ?? {}, user);
  await audit(env, user, body.coupon?.id ? "Kuponu düzenledi" : "Kupon oluşturdu", `${coupon.code} · ${coupon.title}`);
  return json({ coupon });
});

export const onRequestDelete = adminHandler("coupons", async ({ request, env, user }) => {
  const id = new URL(request.url).searchParams.get("id");
  const c = (await listCoupons(env)).find((x) => x.id === id);
  if (!c) throw new AdminError("Kupon bulunamadı", 404);
  await deleteCoupon(env, id);
  await audit(env, user, "Kuponu sildi", `${c.code} · ${c.title}`);
  return json({ deleted: true });
});

export const onRequestPost = adminHandler("coupons.redeem", async ({ request, env, user }) => {
  const body = (await request.json().catch(() => ({}))).redeem ?? {};
  let phone;
  try { phone = normalizePhone(body.phone); } catch (e) { throw new AdminError(e.message); }
  const member = await getMember(env, phone);
  if (!member) throw new AdminError("Bu numarayla kayıtlı üye yok", 404);
  if (member.disabled) throw new AdminError("Bu üyelik durdurulmuş");
  const { coupon, entry } = await redeemCoupon(env, { ...body, phone }, user);
  await audit(env, user, "Kupon kullandırdı", `${coupon.code} · ${member.name} (${phone})`);
  return json({ entry, coupon, member: { name: member.name, phone } });
});
