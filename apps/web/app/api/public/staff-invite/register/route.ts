import { registerStaffInviteAccountServer } from "@/lib/auth/staff-invite-register-server";
import { resolveRequestOriginFromRequest } from "@/lib/navigation/request-origin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: {
    token?: string;
    email?: string;
    password?: string;
    givenName?: string;
    familyName?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const token = body.token?.trim() ?? "";
  const email = body.email?.trim() ?? "";
  const password = body.password ?? "";
  const givenName = body.givenName?.trim() ?? "";
  const familyName = body.familyName?.trim() ?? "";

  if (!token || !email || !password || !givenName || !familyName) {
    return Response.json({ error: "missing_fields" }, { status: 400 });
  }

  const origin = resolveRequestOriginFromRequest(req);
  const result = await registerStaffInviteAccountServer({
    token,
    email,
    password,
    givenName,
    familyName,
    origin,
  });

  if (!result.ok) {
    const status =
      result.error === "already_registered" || result.error === "email_mismatch"
        ? 400
        : result.error === "smtp_not_configured" || result.error === "smtp_incomplete"
          ? 503
          : 500;
    return Response.json(
      { error: result.error, message: result.message },
      { status },
    );
  }

  return Response.json({ ok: true, needsConfirmation: result.needsConfirmation });
}
