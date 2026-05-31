import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function assertSuperadminApi(): Promise<
  | { ok: true; userId: string }
  | { ok: false; status: number; error: string }
> {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, status: 401, error: "unauthorized" };

  const { data: isSuper, error } = await sb.rpc("auth_is_superadmin");
  if (error || !isSuper) {
    return { ok: false, status: 403, error: "forbidden" };
  }

  return { ok: true, userId: user.id };
}
