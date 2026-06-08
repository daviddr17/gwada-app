import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type {
  RestaurantStaffWorkEntryRow,
  StaffAuditLogChange,
  StaffContractLogAction,
  StaffContractLogDetails,
  StaffWorkEntryType,
} from "@/lib/types/staff";
import { STAFF_WORK_ENTRY_LABELS } from "@/lib/types/staff";
import { formatStaffContractLogActorLabel } from "@/lib/staff/staff-contract-log";

const whenFmt = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatWorkEntryInstant(iso: string): string {
  return whenFmt.format(new Date(iso));
}

function formatEntryType(type: StaffWorkEntryType): string {
  return STAFF_WORK_ENTRY_LABELS[type];
}

export function buildStaffWorkEntryChanges(
  before: Pick<
    RestaurantStaffWorkEntryRow,
    "entry_type" | "starts_at" | "ends_at"
  > | null,
  after: Pick<
    RestaurantStaffWorkEntryRow,
    "entry_type" | "starts_at" | "ends_at"
  >,
): StaffAuditLogChange[] {
  const changes: StaffAuditLogChange[] = [];

  const push = (
    field: string,
    label: string,
    from: string | null,
    to: string | null,
  ) => {
    if (from === to) return;
    changes.push({ field, label, from, to });
  };

  if (!before) {
    push("entry_type", "Art", null, formatEntryType(after.entry_type));
    push("starts_at", "Beginn", null, formatWorkEntryInstant(after.starts_at));
    push("ends_at", "Ende", null, formatWorkEntryInstant(after.ends_at));
    return changes;
  }

  push(
    "entry_type",
    "Art",
    formatEntryType(before.entry_type),
    formatEntryType(after.entry_type),
  );
  push(
    "starts_at",
    "Beginn",
    formatWorkEntryInstant(before.starts_at),
    formatWorkEntryInstant(after.starts_at),
  );
  push(
    "ends_at",
    "Ende",
    formatWorkEntryInstant(before.ends_at),
    formatWorkEntryInstant(after.ends_at),
  );
  return changes;
}

function formatChangeSummary(changes: StaffAuditLogChange[]): string {
  return changes
    .map((c) => `${c.label}: „${c.from ?? "—"}“ → „${c.to ?? "—"}“`)
    .join(" · ");
}

export function formatStaffWorkEntryLogSummary(
  action: StaffContractLogAction,
  changes: StaffAuditLogChange[],
): string {
  if (action === "created") {
    if (changes.length === 0) return "Eintrag angelegt";
    return formatChangeSummary(changes);
  }
  if (changes.length === 0) {
    return "Gespeichert (keine Feldänderungen)";
  }
  return formatChangeSummary(changes);
}

/** Anzeige — korrigiert ältere Einträge mit Vertrags-Text aus gemeinsamer Log-Hilfe. */
export function formatStaffWorkEntryLogDisplaySummary(params: {
  action: StaffContractLogAction;
  details: { summary?: string; changes?: StaffAuditLogChange[] };
}): string {
  const stored = params.details.summary?.trim();
  if (stored && stored !== "Vertrag angelegt") {
    return stored;
  }
  return formatStaffWorkEntryLogSummary(
    params.action,
    params.details.changes ?? [],
  );
}

export async function insertStaffWorkEntryLogEntry(
  restaurantId: string,
  workEntryId: string,
  action: StaffContractLogAction,
  changes: StaffAuditLogChange[],
  summaryOverride?: string,
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("given_name, family_name")
    .eq("id", user.id)
    .maybeSingle();

  const details: StaffContractLogDetails = {
    actorGivenName: (profile?.given_name as string | null) ?? "",
    actorFamilyName: (profile?.family_name as string | null) ?? "",
    changes,
    summary:
      summaryOverride ?? formatStaffWorkEntryLogSummary(action, changes),
  };

  const { error } = await supabase
    .from("restaurant_staff_work_entry_log_entries")
    .insert({
      restaurant_id: restaurantId,
      work_entry_id: workEntryId,
      actor_user_id: user.id,
      action,
      details,
    });

  if (error) {
    console.warn("[gwada] restaurant_staff_work_entry_log_entries", error.message);
  }
}

export { formatStaffContractLogActorLabel };
