import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatStaffAuditLogSummary } from "@/lib/staff/staff-log";
import type {
  StaffAuditLogAction,
  StaffAuditLogDetails,
} from "@/lib/types/staff";
import type { SupabaseClient } from "@supabase/supabase-js";

function isActionCheckViolation(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "23514" ||
    Boolean(error.message?.includes("restaurant_staff_log_entries_action_check"))
  );
}

function isMissingLogTable(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "42P01" ||
    Boolean(error.message?.includes("restaurant_staff_log_entries"))
  );
}

async function tryInsert(
  client: SupabaseClient,
  row: {
    restaurantId: string;
    staffId: string;
    actorUserId: string;
    action: StaffAuditLogAction;
    details: StaffAuditLogDetails;
  },
): Promise<{ ok: boolean; error?: string; missingTable?: boolean }> {
  let action = row.action;
  let details = row.details;

  const insertRow = async () =>
    client.from("restaurant_staff_log_entries").insert({
      restaurant_id: row.restaurantId,
      staff_id: row.staffId,
      actor_user_id: row.actorUserId,
      action,
      details,
    });

  let { error } = await insertRow();

  if (error && isActionCheckViolation(error) && action !== "updated") {
    action = "updated";
    details = {
      ...details,
      summary: `[${row.action}] ${details.summary ?? ""}`.trim(),
    };
    ({ error } = await insertRow());
  }

  if (error) {
    return {
      ok: false,
      error: error.message,
      missingTable: isMissingLogTable(error),
    };
  }

  return { ok: true };
}

export async function insertStaffAuditLogEntryServer(params: {
  restaurantId: string;
  staffId: string;
  actorUserId: string;
  action: StaffAuditLogAction;
  details?: Partial<StaffAuditLogDetails>;
  /** Fallback wenn kein Service-Role-Key (lokale Entwicklung). */
  sessionSupabase?: SupabaseClient;
}): Promise<{ ok: boolean; error?: string }> {
  const clients: SupabaseClient[] = [];
  const admin = createSupabaseAdminClient();
  if (admin) clients.push(admin);
  if (params.sessionSupabase) clients.push(params.sessionSupabase);

  if (clients.length === 0) {
    return { ok: false, error: "no_supabase_client" };
  }

  const profileClient = admin ?? params.sessionSupabase!;
  const { data: profile } = await profileClient
    .from("profiles")
    .select("given_name, family_name")
    .eq("id", params.actorUserId)
    .maybeSingle();

  const details: StaffAuditLogDetails = {
    actorGivenName: (profile?.given_name as string | null) ?? "",
    actorFamilyName: (profile?.family_name as string | null) ?? "",
    changes: params.details?.changes ?? [],
    summary:
      params.details?.summary ??
      formatStaffAuditLogSummary(params.action, params.details?.changes ?? []),
  };

  let lastError: string | undefined;
  for (const client of clients) {
    const result = await tryInsert(client, {
      restaurantId: params.restaurantId,
      staffId: params.staffId,
      actorUserId: params.actorUserId,
      action: params.action,
      details,
    });
    if (result.ok) return { ok: true };
    lastError = result.error;
    if (result.missingTable) break;
  }

  if (lastError) {
    console.warn("[gwada] restaurant_staff_log_entries", lastError);
  }
  return { ok: false, error: lastError ?? "insert_failed" };
}
