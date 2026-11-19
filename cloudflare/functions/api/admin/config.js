// GET/PUT /api/admin/config: read and save the configuration.
// Each part of the document is saved only when the user holds its permission; other parts keep
// their stored value, so a staff member can never change what they may not see.
import { isJson } from "../../_lib/auth.js";
import { json, readConfig, sanitizeConfig, ValidationError, writeConfig } from "../../_lib/config.js";
import { adminHandler, audit, can } from "../../_lib/staff.js";

const NO_STORE = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

/** Config section -> permission that may change it. */
const SECTIONS = {
  products: "prices",
  site: "site",
  store: "store",
  announcement: "store",
  members: "memberPrices",
  memberDeals: "memberPrices",
  feed: "settings",
};

const LABELS = { products: "fiyatlar", site: "web sitesi", store: "mağaza bilgileri", announcement: "duyuru", members: "üyelik ayarı", memberDeals: "üye fiyatları", feed: "fiyat kaynağı" };

export const onRequestGet = adminHandler(null, async ({ env }) =>
  json((await readConfig(env)) ?? { schema: 1, version: 0 }, { headers: NO_STORE }));

export const onRequestPut = adminHandler(null, async (context) => {
  const { request, env, user } = context;
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
  const changed = [];
  for (const [section, perm] of Object.entries(SECTIONS)) {
    const before = JSON.stringify(previous?.[section] ?? null);
    if (!can(user, perm)) {
      if (previous && section in previous) body[section] = previous[section];
      else delete body[section];
    } else if (JSON.stringify(body[section] ?? null) !== before) {
      changed.push(LABELS[section]);
    }
  }
  try {
    const doc = await writeConfig(env, sanitizeConfig(body), previous);
    // Free KV space: photos no longer used by any category or product are deleted.
    context.waitUntil?.(deleteUnusedMedia(env, previous, doc));
    if (changed.length) await audit(env, user, "Ayarları kaydetti", [...new Set(changed)].join(", "));
    return json(doc, { headers: NO_STORE });
  } catch (e) {
    if (e instanceof ValidationError) return json({ error: e.message }, { status: 422 });
    throw e;
  }
});

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
