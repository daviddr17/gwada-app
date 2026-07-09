import { sendMagicLinkEmailServer } from "@/lib/auth/magic-link-email-server";
import { resolvePublicAppOrigin } from "@/lib/navigation/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { email?: string; next?: string | null };
  try {
    body = (await req.json()) as { email?: string; next?: string | null };
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const email = body.email?.trim();
  if (!email || !email.includes("@")) {
    return Response.json({ error: "invalid_email" }, { status: 400 });
  }

  const origin = resolvePublicAppOrigin(req);
  const sb = await createSupabaseServerClient();
  const result = await sendMagicLinkEmailServer({
    email,
    origin,
    nextPath: body.next ?? null,
    brandingClient: sb,
  });

  if (!result.ok) {
    if (result.error === "smtp_not_configured" || result.error === "smtp_incomplete") {
      return Response.json(
        { error: "E-Mail-Versand ist derzeit nicht eingerichtet." },
        { status: 503 },
      );
    }
    return Response.json(
      { error: "Der Anmelde-Link konnte nicht gesendet werden." },
      { status: 500 },
    );
  }

  return Response.json({ ok: true });
}
