// POST /api/member/login {phone, password} -> {token, ...memberPayload}
import { isJson } from "../../_lib/auth.js";
import { json } from "../../_lib/config.js";
import {
  corsPreflight, getMember, guardFailures, handle, issueMemberToken, MemberError, normalizePhone, putMember,
  recordMemberFailure, verifyMemberPassword,
} from "../../_lib/members.js";
import { memberPayload } from "../../_lib/memberPayload.js";

export const onRequestOptions = corsPreflight;

export const onRequestPost = handle(async ({ request, env }) => {
  if (!isJson(request)) throw new MemberError("Geçersiz istek", 415);
  await guardFailures(request, env);
  const body = await request.json().catch(() => ({}));
  const phone = normalizePhone(body.phone);
  const member = await getMember(env, phone);
  if (!member || !(await verifyMemberPassword(member, body.password))) {
    await recordMemberFailure(request, env);
    throw new MemberError("Telefon numarası veya şifre hatalı", 401);
  }
  if (member.disabled) throw new MemberError("Üyeliğiniz mağaza tarafından durduruldu", 403);
  member.lastSeen = new Date().toISOString();
  await putMember(env, member);
  return json(await memberPayload(env, member, { token: await issueMemberToken(env, member) }));
});
