// GET  /api/admin/members            -> {members:[...]}            (members.view)
// GET  /api/admin/members?phone=...  -> {member, coupons, redemptions}
// POST /api/admin/members {phone, action, ...}                     (members.edit)
//   action: disable | enable | note {note} | tags {tags} | password {password} | delete
import { json } from "../../_lib/config.js";
import { listRedemptions, memberCoupons } from "../../_lib/loyalty.js";
import { deleteMember, getMember, listMembers, MemberError, normalizePhone, putMember, setMemberPassword } from "../../_lib/members.js";
import { AdminError, adminHandler, audit } from "../../_lib/staff.js";

function phoneOf(v) {
  try { return normalizePhone(v); } catch (e) { throw new AdminError(e.message); }
}

export const onRequestGet = adminHandler("members.view", async ({ request, env }) => {
  const phone = new URL(request.url).searchParams.get("phone");
  if (!phone) return json({ members: await listMembers(env) });
  const m = await getMember(env, phoneOf(phone));
  if (!m) throw new AdminError("Üye bulunamadı", 404);
  const [coupons, used] = await Promise.all([memberCoupons(env, m.phone), listRedemptions(env)]);
  const { password, session, ...member } = m;
  return json({ member, coupons, redemptions: used.filter((r) => r.phone === m.phone) });
});

export const onRequestPost = adminHandler("members.edit", async ({ request, env, user }) => {
  const body = await request.json().catch(() => ({}));
  const m = await getMember(env, phoneOf(body.phone));
  if (!m) throw new AdminError("Üye bulunamadı", 404);
  const who = `${m.name} (${m.phone})`;
  switch (body.action) {
    case "disable":
      m.disabled = true;
      m.session = crypto.randomUUID();
      await putMember(env, m);
      await audit(env, user, "Üyeliği durdurdu", who);
      break;
    case "enable":
      m.disabled = false;
      await putMember(env, m);
      await audit(env, user, "Üyeliği açtı", who);
      break;
    case "note":
      m.note = String(body.note ?? "").slice(0, 500);
      await putMember(env, m);
      await audit(env, user, "Üye notunu değiştirdi", who);
      break;
    case "tags":
      m.tags = [...new Set((Array.isArray(body.tags) ? body.tags : []).map((t) => String(t).trim().slice(0, 24)).filter(Boolean))].slice(0, 10);
      await putMember(env, m);
      await audit(env, user, "Üye etiketlerini değiştirdi", `${who}: ${m.tags.join(", ")}`);
      break;
    case "password":
      try { await setMemberPassword(m, String(body.password ?? "")); } catch (e) { throw new AdminError(e instanceof MemberError ? e.message : "Şifre değiştirilemedi"); }
      await putMember(env, m);
      await audit(env, user, "Üyenin şifresini yeniledi", who);
      break;
    case "delete":
      await deleteMember(env, m.phone);
      await audit(env, user, "Üyeyi sildi", who);
      return json({ deleted: true });
    default:
      throw new AdminError("Bilinmeyen işlem");
  }
  const { password, session, ...member } = m;
  return json({ member });
});
