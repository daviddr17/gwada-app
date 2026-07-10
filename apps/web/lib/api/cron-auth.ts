import "server-only";

/** Cron-Routen: Secret ist Pflicht — fehlendes Secret = misconfigured (fail-closed). */
export function assertCronAuthorized(req: Request): Response | null {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token !== secret) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  return null;
}
