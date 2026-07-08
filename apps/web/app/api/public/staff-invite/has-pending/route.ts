import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { emailHasPendingStaffInviteAdmin } from "@/lib/auth/staff-invite-signup-gate";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const emailRaw = new URL(request.url).searchParams.get("email") ?? "";
  const email = emailRaw.trim().toLowerCase();

  if (!email || !email.includes("@")) {
    return Response.json({ pending: false });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_config" }, { status: 503 });
  }

  const pending = await emailHasPendingStaffInviteAdmin(admin, email);
  return Response.json({ pending });
}
