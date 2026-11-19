// GET /api/admin/log -> {log}  (logs)
import { json } from "../../_lib/config.js";
import { adminHandler, readLog } from "../../_lib/staff.js";

export const onRequestGet = adminHandler("logs", async ({ env }) => json({ log: await readLog(env) }));
