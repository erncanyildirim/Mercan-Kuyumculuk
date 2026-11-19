// GET    /api/member/me                       -> memberPayload
// PUT    /api/member/me {name?, oldPassword?, password?} -> memberPayload (+ new token after a password change)
// POST   /api/member/me {read: true}          -> marks all messages read
// DELETE /api/member/me {password}            -> deletes the account (App Store requirement for sign-up apps)
import { json } from "../../_lib/config.js";
import {
  cleanName, corsPreflight, deleteMember, handle, issueMemberToken, MemberError, putMember, recordMemberFailure,
  requireMember, setMemberPassword, verifyMemberPassword,
} from "../../_lib/members.js";
import { memberPayload } from "../../_lib/memberPayload.js";

export const onRequestOptions = corsPreflight;

export const onRequestGet = handle(async ({ request, env }) => {
  const member = await requireMember(request, env);
  // lastSeen is refreshed at most once an hour to spare KV writes.
  if (!member.lastSeen || Date.now() - Date.parse(member.lastSeen) > 3600_000) {
    member.lastSeen = new Date().toISOString();
    await putMember(env, member);
  }
  return json(await memberPayload(env, member));
});

export const onRequestPut = handle(async ({ request, env }) => {
  const member = await requireMember(request, env);
  const body = await request.json().catch(() => ({}));
  const extra = {};
  if (body.name !== undefined) member.name = cleanName(body.name);
  if (body.password) {
    if (!(await verifyMemberPassword(member, body.oldPassword))) {
      await recordMemberFailure(request, env);
      throw new MemberError("Mevcut şifreniz hatalı", 401);
    }
    await setMemberPassword(member, String(body.password));
    extra.token = await issueMemberToken(env, member);
  }
  await putMember(env, member);
  return json(await memberPayload(env, member, extra));
});

export const onRequestPost = handle(async ({ request, env }) => {
  const member = await requireMember(request, env);
  const body = await request.json().catch(() => ({}));
  if (body.read) {
    member.readUntil = new Date().toISOString();
    await putMember(env, member);
  }
  return json(await memberPayload(env, member));
});

export const onRequestDelete = handle(async ({ request, env }) => {
  const member = await requireMember(request, env);
  const body = await request.json().catch(() => ({}));
  if (!(await verifyMemberPassword(member, body.password))) {
    await recordMemberFailure(request, env);
    throw new MemberError("Şifre hatalı", 401);
  }
  await deleteMember(env, member.phone);
  return json({ deleted: true });
});
