import { enforceAuthEmailRateLimit } from "@/lib/api/auth-email-rate-limit";
import { scheduleAuthEmailInBackground } from "@/lib/auth/auth-email-background-dispatch";
import { withAuthEmailPrepareTimeout } from "@/lib/auth/auth-email-send-timeout";
import { prepareMagicLinkEmailServer } from "@/lib/auth/magic-link-email-server";
import { resolvePublicAppOrigin } from "@/lib/navigation/request-origin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

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

  const rateLimited = enforceAuthEmailRateLimit(req, email);
  if (rateLimited) return rateLimited;

  const origin = resolvePublicAppOrigin(req);
  const admin = createSupabaseAdminClient();
  let prepared: Awaited<ReturnType<typeof prepareMagicLinkEmailServer>>;
  try {
    prepared = await withAuthEmailPrepareTimeout(
      prepareMagicLinkEmailServer({
        email,
        origin,
        nextPath: body.next ?? null,
        brandingClient: admin ?? undefined,
      }),
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/E-Mail-Vorbereitung: keine Antwort/i.test(msg)) {
      return Response.json(
        {
          error:
            "Die Anfrage hat zu lange gedauert. Bitte in ein paar Sekunden erneut versuchen.",
        },
        { status: 504 },
      );
    }
    throw e;
  }

  if (
    !prepared.ok &&
    (prepared.error === "smtp_not_configured" ||
      prepared.error === "smtp_incomplete")
  ) {
    return Response.json(
      { error: "E-Mail-Versand ist derzeit nicht eingerichtet." },
      { status: 503 },
    );
  }

  if (!prepared.ok) {
    if (prepared.error === "admin_unavailable") {
      return Response.json(
        { error: "E-Mail-Versand ist derzeit nicht verfügbar." },
        { status: 503 },
      );
    }
    console.warn("magic-link prepare", prepared.error);
    return Response.json({ error: "invalid_email" }, { status: 400 });
  }

  scheduleAuthEmailInBackground(prepared.prepared);

  return Response.json({ ok: true });
}
