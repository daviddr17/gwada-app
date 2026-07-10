import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Sucht ein Auth-Konto per E-Mail (Admin-Client). */
export async function findAuthUserIdByEmailAdmin(
  admin: SupabaseClient,
  email: string,
): Promise<string | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  const { data, error } = await admin.rpc("auth_user_id_by_email", {
    p_email: normalized,
  });
  if (!error && typeof data === "string" && data.trim()) {
    return data.trim();
  }
  if (error && !/could not find the function|does not exist/i.test(error.message)) {
    console.warn("[auth] auth_user_id_by_email", error.message);
  }

  let page = 1;
  const perPage = 200;
  while (page <= 25) {
    const { data: listed, error: listError } = await admin.auth.admin.listUsers({
      page,
      perPage,
    });
    if (listError) {
      console.warn("[auth] email lookup", listError.message);
      return null;
    }
    const users = listed.users ?? [];
    const match = users.find(
      (user) => normalizeEmail(user.email ?? "") === normalized,
    );
    if (match) return match.id;
    if (users.length < perPage) break;
    page += 1;
  }
  return null;
}
