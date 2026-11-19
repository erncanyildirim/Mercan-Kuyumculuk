// POST /api/admin/media (body: the image bytes) -> {id}: stores a product photo (admin only).
import { json } from "../../_lib/config.js";
import { adminHandler } from "../../_lib/staff.js";

const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 1_500_000;

export const onRequestPost = adminHandler("site", async ({ request, env }) => {
  const type = (request.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  if (!TYPES.has(type)) return json({ error: "Yalnızca JPG, PNG veya WEBP yükleyebilirsiniz" }, { status: 415 });
  const body = await request.arrayBuffer();
  if (!body.byteLength) return json({ error: "Dosya boş" }, { status: 400 });
  if (body.byteLength > MAX_BYTES) return json({ error: "Fotoğraf en fazla 1,5 MB olabilir" }, { status: 413 });
  const id = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
  await env.CONFIG.put(`media:${id}`, body, { metadata: { type, size: body.byteLength, at: new Date().toISOString() } });
  return json({ id, url: `/api/media/${id}` }, { headers: { "Cache-Control": "no-store" } });
});
