import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/** Nur setzen, wenn auth.users.id auch in profiles existiert (FK created_by/updated_by). */
export async function resolveAccountingActorUserId(
  sb: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data } = await sb
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export function connectorSyncWriteErrorMessage(
  label: string,
  firstWriteError: string | null,
): string {
  if (!firstWriteError) return `${label} konnten nicht gespeichert werden.`;
  return `${label} konnten nicht gespeichert werden: ${firstWriteError}`;
}
