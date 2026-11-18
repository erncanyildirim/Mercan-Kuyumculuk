// GET/PUT /api/admin/config: read and save the configuration (admin only).
import { isJson, requireAdmin } from "../../_lib/auth.js";
import { json, readConfig, sanitizeConfig, ValidationError, writeConfig } from "../../_lib/config.js";

const NO_STORE = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

export async function onRequestGet({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  return json((await readConfig(env)) ?? { schema: 1, version: 0 }, { headers: NO_STORE });
}

export async function onRequestPut(context) {
  const { request, env } = context;
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  if (!isJson(request)) return json({ error: "Geçersiz istek" }, { status: 415 });
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Geçersiz istek" }, { status: 400 });
  }
  const previous = await readConfig(env);
  // Reject saves made from a stale copy so two open admin tabs cannot overwrite each other.
  if (typeof body.version === "number" && previous && body.version !== previous.version) {
    return json({ error: "Ayarlar başka bir yerde değiştirilmiş. Sayfayı yenileyip tekrar deneyin." }, { status: 409 });
  }
  try {
    const doc = await writeConfig(env, sanitizeConfig(body), previous);
    // Free KV space: photos no longer used by any category or product are deleted.
    context.waitUntil?.(deleteUnusedMedia(env, previous, doc));
    return json(doc, { headers: NO_STORE });
  } catch (e) {
    if (e instanceof ValidationError) return json({ error: e.message }, { status: 422 });
    throw e;
  }
}

// Photos uploaded but not saved yet stay this long, so an upload is not lost while the admin is still editing.
const UNSAVED_GRACE_MS = 6 * 60 * 60 * 1000;

function imagesOf(doc) {
  const site = doc?.site ?? {};
  return new Set([...(site.items ?? []), ...(site.categories ?? [])].map((p) => p.image).filter(Boolean));
}

async function deleteUnusedMedia(env, previous, doc) {
  try {
    const used = imagesOf(doc);
    const doomed = new Set([...imagesOf(previous)].filter((id) => !used.has(id)));
    let cursor;
    do {
      const page = await env.CONFIG.list({ prefix: "media:", cursor });
      for (const key of page.keys) {
        const id = key.name.slice("media:".length);
        const at = Date.parse(key.metadata?.at || "") || 0;
        if (!used.has(id) && Date.now() - at > UNSAVED_GRACE_MS) doomed.add(id);
      }
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
    await Promise.all([...doomed].map((id) => env.CONFIG.delete(`media:${id}`)));
  } catch {
    // Cleanup is best effort; the next save tries again.
  }
}
