// POST /api/admin/login {password} (owner) or {username, password} (staff) -> {token, user}
import { clearFailures, isJson, isLocked, issueToken, recordFailure, safeEqual } from "../../_lib/auth.js";
import { json } from "../../_lib/config.js";
import { ALL, AdminError, audit, checkStaffLogin } from "../../_lib/staff.js";

export async function onRequestPost({ request, env }) {
  if (!env.ADMIN_PASSWORD) return json({ error: "ADMIN_PASSWORD tanımlı değil" }, { status: 503 });
  if (!isJson(request)) return json({ error: "Geçersiz istek" }, { status: 415 });
  if (await isLocked(request, env)) {
    return json({ error: "Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin." }, { status: 429 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Geçersiz istek" }, { status: 400 });
  }
  const password = String(body.password ?? "");
  const username = String(body.username ?? "").trim();
  const headers = { "Cache-Control": "no-store" };

  if (!username) {
    if (!(await safeEqual(password, env.ADMIN_PASSWORD))) {
      await recordFailure(request, env);
      return json({ error: "Şifre hatalı" }, { status: 401 });
    }
    await clearFailures(request, env);
    const user = { owner: true, username: "owner", name: "Mağaza sahibi", perms: [...ALL, "staff"] };
    await audit(env, user, "Giriş yaptı");
    return json({ token: await issueToken(env), user }, { headers });
  }

  let staff;
  try {
    staff = await checkStaffLogin(env, username, password);
  } catch (e) {
    if (e instanceof AdminError) return json({ error: e.message }, { status: e.status });
    throw e;
  }
  if (!staff) {
    await recordFailure(request, env);
    return json({ error: "Kullanıcı adı veya şifre hatalı" }, { status: 401 });
  }
  await clearFailures(request, env);
  const user = { owner: false, username: staff.username, name: staff.name, perms: staff.perms };
  await audit(env, user, "Giriş yaptı");
  return json({ token: await issueToken(env, Date.now(), { u: staff.username, s: staff.session }), user }, { headers });
}
