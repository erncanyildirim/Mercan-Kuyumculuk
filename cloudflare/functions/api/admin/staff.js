// GET    /api/admin/staff                 -> {staff, permissions}   (owner)
// PUT    /api/admin/staff {staff}         -> {staff}                (owner): create or update
// DELETE /api/admin/staff?username=...                              (owner)
import { json } from "../../_lib/config.js";
import { AdminError, adminHandler, audit, cleanUsername, deleteStaff, getStaff, listStaff, PERMISSIONS, publicStaff, saveStaff } from "../../_lib/staff.js";

export const onRequestGet = adminHandler("staff", async ({ env }) => json({ staff: await listStaff(env), permissions: PERMISSIONS }));

export const onRequestPut = adminHandler("staff", async ({ request, env, user }) => {
  const input = (await request.json().catch(() => ({}))).staff ?? {};
  const username = cleanUsername(input.username);
  const existing = await getStaff(env, username);
  if (input.create && existing) throw new AdminError("Bu kullanıcı adı zaten var");
  const saved = await saveStaff(env, input, existing);
  await audit(env, user, existing ? "Personeli düzenledi" : "Personel ekledi", `${saved.name} (${saved.username}) · ${saved.perms.length} yetki${saved.active ? "" : " · pasif"}`);
  return json({ staff: publicStaff(saved) });
});

export const onRequestDelete = adminHandler("staff", async ({ request, env, user }) => {
  const username = new URL(request.url).searchParams.get("username");
  const s = username && (await getStaff(env, username));
  if (!s) throw new AdminError("Personel bulunamadı", 404);
  await deleteStaff(env, s.username);
  await audit(env, user, "Personeli sildi", `${s.name} (${s.username})`);
  return json({ deleted: true });
});
