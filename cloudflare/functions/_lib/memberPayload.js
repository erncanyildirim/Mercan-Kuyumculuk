// Shared response for register / login / me: profile, members-only prices, coupons and messages.
import { readConfig } from "./config.js";
import { memberCoupons, memberNotices } from "./loyalty.js";
import { profile } from "./members.js";

export async function memberPayload(env, member, extra = {}) {
  const config = (await readConfig(env)) ?? {};
  const enabled = !!config.members?.enabled;
  const [coupons, notices] = await Promise.all([memberCoupons(env, member.phone), memberNotices(env, member)]);
  return {
    ...extra,
    member: profile(member),
    enabled,
    note: config.members?.note ?? "",
    // Member prices only apply while the jeweler has membership switched on.
    deals: enabled ? config.memberDeals ?? {} : {},
    coupons,
    notices,
    unread: notices.filter((n) => !n.read).length,
    version: config.version ?? 0,
  };
}
