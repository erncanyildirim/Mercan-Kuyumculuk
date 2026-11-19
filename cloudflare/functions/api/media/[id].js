// GET /api/media/:id: a product photo uploaded from the admin panel.
const MEDIA_ID = /^[a-f0-9]{32}$/;

export async function onRequestGet({ params, env }) {
  const id = String(params.id || "");
  if (!MEDIA_ID.test(id)) return new Response("Not found", { status: 404 });
  const { value, metadata } = await env.CONFIG.getWithMetadata(`media:${id}`, { type: "arrayBuffer" });
  if (!value) return new Response("Not found", { status: 404 });
  return new Response(value, {
    headers: {
      "Content-Type": metadata?.type || "image/jpeg",
      // Ids are random and never reused, so the file can be cached forever.
      "Cache-Control": "public, max-age=31536000, immutable",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
