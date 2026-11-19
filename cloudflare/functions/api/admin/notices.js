// GET    /api/admin/notices        -> {notices}   (notify)
// POST   /api/admin/notices {...}  -> {notice}    (notify): send to all members or selected ones
// DELETE /api/admin/notices?id=...                (notify)
import { json } from "../../_lib/config.js";
import { deleteNotice, listNotices, sendNotice } from "../../_lib/loyalty.js";
import { AdminError, adminHandler, audit } from "../../_lib/staff.js";

export const onRequestGet = adminHandler("notify", async ({ env }) => json({ notices: await listNotices(env) }));

export const onRequestPost = adminHandler("notify", async ({ request, env, user }) => {
  const body = await request.json().catch(() => ({}));
  const notice = await sendNotice(env, body, user);
  await audit(env, user, "Bildirim gönderdi", `${notice.title} → ${notice.audience === "all" ? "tüm üyeler" : `${notice.members.length} üye`}`);
  return json({ notice });
});

export const onRequestDelete = adminHandler("notify", async ({ request, env, user }) => {
  const id = new URL(request.url).searchParams.get("id");
  const n = (await listNotices(env)).find((x) => x.id === id);
  if (!n) throw new AdminError("Bildirim bulunamadı", 404);
  await deleteNotice(env, id);
  await audit(env, user, "Bildirimi geri çekti", n.title);
  return json({ deleted: true });
});
