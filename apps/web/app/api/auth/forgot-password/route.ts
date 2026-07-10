import { enforceAuthEmailRateLimit } from "@/lib/api/auth-email-rate-limit";
import { withAuthEmailSendTimeout } from "@/lib/auth/auth-email-send-timeout";
import { sendPasswordResetEmailServer } from "@/lib/auth/password-reset-email-server";
import { resolvePublicAppOrigin } from "@/lib/navigation/request-origin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

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
  let result: Awaited<ReturnType<typeof sendPasswordResetEmailServer>>;
  try {
    result = await withAuthEmailSendTimeout(
      sendPasswordResetEmailServer({
        email,
        origin,
        nextPath: body.next ?? null,
        brandingClient: admin ?? undefined,
      }),
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/E-Mail-Versand: keine Antwort/i.test(msg)) {
      return Response.json(
        {
          error:
            "E-Mail-Versand hat zu lange gedauert. Bitte später erneut versuchen.",
        },
        { status: 504 },
      );
    }
    throw e;
  }

  if (
    !result.ok &&
    (result.error === "smtp_not_configured" || result.error === "smtp_incomplete")
  ) {
    return Response.json(
      { error: "E-Mail-Versand ist derzeit nicht eingerichtet." },
      { status: 503 },
    );
  }

  if (!result.ok) {
    console.warn("forgot-password send", result.error);
  }

  return Response.json({ ok: true });
}
