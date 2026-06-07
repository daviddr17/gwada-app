import {
  resolveStaffInvitePreview,
  resolveStaffInviteViewerStatus,
  normalizeStaffInviteToken,
  getStaffInviteAdminClient,
} from "@/lib/staff/staff-invite-preview-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const tokenRaw = new URL(req.url).searchParams.get("token") ?? "";
  const token = normalizeStaffInviteToken(tokenRaw);

  if (token.length < 16) {
    return Response.json({ error: "invalid" }, { status: 400 });
  }

  const admin = await getStaffInviteAdminClient();
  if (!admin) {
    return Response.json({ error: "server_config" }, { status: 500 });
  }

  const result = await resolveStaffInvitePreview(admin, token);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 404 });
  }

  const userSb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await userSb.auth.getUser();

  const viewerStatus = await resolveStaffInviteViewerStatus(
    admin,
    result.invite,
    user?.id ?? null,
  );

  return Response.json({
    ok: true,
    invite: result.invite,
    viewerStatus,
    viewerLoggedIn: Boolean(user),
  });
}
