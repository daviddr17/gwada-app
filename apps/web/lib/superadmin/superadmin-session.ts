import type { SupabaseClient } from "@supabase/supabase-js";

export function isSuperadminAppPath(pathname: string): boolean {
  return pathname === "/superadmin" || pathname.startsWith("/superadmin/");
}

export type SuperadminSessionResult =
  | { status: "ok"; userId: string }
  | { status: "unauthenticated" }
  | { status: "forbidden" };

/** Session + `auth_is_superadmin` — nutzbar in Proxy und Server Components. */
export async function getSuperadminSession(
  sb: SupabaseClient,
): Promise<SuperadminSessionResult> {
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { status: "unauthenticated" };

  const { data: isSuper, error } = await sb.rpc("auth_is_superadmin");
  if (error || !isSuper) return { status: "forbidden" };

  return { status: "ok", userId: user.id };
}
