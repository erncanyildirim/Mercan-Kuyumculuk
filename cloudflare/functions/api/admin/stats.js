// GET /api/admin/stats -> numbers for the dashboard (dashboard)
import { json, readConfig } from "../../_lib/config.js";
import { couponOpen, listCoupons, listNotices, listRedemptions } from "../../_lib/loyalty.js";
import { listMembers } from "../../_lib/members.js";
import { adminHandler, can, readLog } from "../../_lib/staff.js";

export const onRequestGet = adminHandler("dashboard", async ({ env, user }) => {
  const [members, coupons, used, notices, config, log] = await Promise.all([
    listMembers(env), listCoupons(env), listRedemptions(env), listNotices(env), readConfig(env), can(user, "logs") ? readLog(env) : [],
  ]);
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
  const custom = Object.values(config?.products ?? {}).filter((p) => p.mode !== "live" || p.visible === false).length;
  return json({
    members: { total: members.length, newThisWeek: members.filter((m) => m.createdAt >= weekAgo).length, disabled: members.filter((m) => m.disabled).length, recent: members.slice(0, 5) },
    coupons: { total: coupons.length, open: coupons.filter((c) => couponOpen(c)).length, usedThisWeek: used.filter((r) => r.at >= weekAgo).length },
    notices: { total: notices.length, last: notices[0] ?? null },
    prices: { custom, version: config?.version ?? 0, updatedAt: config?.updatedAt ?? null },
    membership: { enabled: !!config?.members?.enabled, deals: Object.keys(config?.memberDeals ?? {}).length },
    items: (config?.site?.items ?? []).length,
    log: log.slice(0, 8),
  });
});
