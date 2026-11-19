// GET /api/admin/me -> the signed-in panel user and the permission list
import { json } from "../../_lib/config.js";
import { adminHandler, PERMISSIONS } from "../../_lib/staff.js";

export const onRequestGet = adminHandler(null, async ({ user }) => json({ user, permissions: PERMISSIONS }));
