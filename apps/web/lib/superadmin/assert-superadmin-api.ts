import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSuperadminSession } from "@/lib/superadmin/superadmin-session";

export async function assertSuperadminApi(): Promise<
  | { ok: true; userId: string }
  | { ok: false; status: number; error: string }
> {
  const sb = await createSupabaseServerClient();
  const session = await getSuperadminSession(sb);

  if (session.status === "unauthenticated") {
    return { ok: false, status: 401, error: "unauthorized" };
  }
  if (session.status === "forbidden") {
    return { ok: false, status: 403, error: "forbidden" };
  }

  return { ok: true, userId: session.userId };
}
