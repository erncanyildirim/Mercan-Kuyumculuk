// POST /api/member/register {name, phone, password} -> {token, ...memberPayload}
import { isJson } from "../../_lib/auth.js";
import { json, readConfig } from "../../_lib/config.js";
import { corsPreflight, createMember, guardFailures, handle, issueMemberToken, MemberError } from "../../_lib/members.js";
import { memberPayload } from "../../_lib/memberPayload.js";

export const onRequestOptions = corsPreflight;

export const onRequestPost = handle(async ({ request, env }) => {
  if (!isJson(request)) throw new MemberError("Geçersiz istek", 415);
  await guardFailures(request, env);
  const config = await readConfig(env);
  if (!config?.members?.enabled) throw new MemberError("Üyelik şu anda kapalı", 403);
  const body = await request.json().catch(() => ({}));
  const member = await createMember(env, body);
  return json(await memberPayload(env, member, { token: await issueMemberToken(env, member) }), { status: 201 });
});
