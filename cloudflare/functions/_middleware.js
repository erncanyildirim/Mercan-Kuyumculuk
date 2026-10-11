// Security headers for every response, and no indexing of the admin area.
export async function onRequest({ request, next }) {
  const response = await next();
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  const path = new URL(request.url).pathname;
  if (path.startsWith("/admin") || path.startsWith("/api/admin")) {
    headers.set("X-Robots-Tag", "noindex, nofollow");
    headers.set("X-Frame-Options", "DENY");
    headers.set("Cache-Control", "no-store");
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
