import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type {
  RestaurantStaffContractRow,
  StaffContractLogAction,
  StaffContractLogChange,
  StaffContractLogDetails,
  StaffContractPayType,
  StaffEmploymentTypeDefinition,
} from "@/lib/types/staff";
import { formatStaffContractPaySummary } from "@/lib/staff/staff-contract-pay";
import { staffEmploymentTypeLabel } from "@/lib/staff/staff-employment-type-label";

function employmentLabelForLog(
  row: Pick<
    RestaurantStaffContractRow,
    "employment_type_id" | "employment_type_name"
  >,
  types: readonly StaffEmploymentTypeDefinition[],
): string {
  return staffEmploymentTypeLabel(row, types) ?? "—";
}

function displayPaySummary(c: {
  pay_type: StaffContractPayType;
  hourly_rate_cents: number | null;
  fixed_salary_cents: number | null;
}): string {
  return formatStaffContractPaySummary(c);
}

function strOrDash(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

function formatTargetWeeklyHours(minutes: number | null): string {
  if (minutes == null) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h} h/Woche`;
  return `${h}:${String(m).padStart(2, "0")} h/Woche`;
}

export function buildStaffContractChanges(
  before: RestaurantStaffContractRow | null,
  after: Omit<
    RestaurantStaffContractRow,
    "id" | "restaurant_id" | "staff_id"
  >,
  employmentTypes: readonly StaffEmploymentTypeDefinition[] = [],
): StaffContractLogChange[] {
  const changes: StaffContractLogChange[] = [];

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
    push("valid_from", "Gültig von", null, after.valid_from);
    push("valid_to", "Gültig bis", null, after.valid_to ?? "offen");
    push("pay", "Vergütung", null, displayPaySummary(after));
    push(
      "employment_type",
      "Beschäftigung",
      null,
      employmentLabelForLog(after, employmentTypes),
    );
    push(
      "vacation_days_per_year",
      "Urlaubstage/Jahr",
      null,
      strOrDash(after.vacation_days_per_year),
    );
    push(
      "target_weekly_minutes",
      "Soll-Wochenstunden",
      null,
      formatTargetWeeklyHours(after.target_weekly_minutes),
    );
    push("note", "Notiz", null, after.note?.trim() || "—");
    return changes;
  }

  push("valid_from", "Gültig von", before.valid_from, after.valid_from);
  push(
    "valid_to",
    "Gültig bis",
    before.valid_to ?? "offen",
    after.valid_to ?? "offen",
  );

  const payBefore = displayPaySummary(before);
  const payAfter = displayPaySummary(after);
  push("pay", "Vergütung", payBefore, payAfter);

  push(
    "employment_type",
    "Beschäftigung",
    employmentLabelForLog(before, employmentTypes),
    employmentLabelForLog(after, employmentTypes),
  );

  push(
    "vacation_days_per_year",
    "Urlaubstage/Jahr",
    strOrDash(before.vacation_days_per_year),
    strOrDash(after.vacation_days_per_year),
  );

  push(
    "target_weekly_minutes",
    "Soll-Wochenstunden",
    formatTargetWeeklyHours(before.target_weekly_minutes),
    formatTargetWeeklyHours(after.target_weekly_minutes),
  );

  push(
    "note",
    "Notiz",
    before.note?.trim() || "—",
    after.note?.trim() || "—",
  );

  return changes;
}

export function formatStaffContractLogSummary(
  action: StaffContractLogAction,
  changes: StaffContractLogChange[],
): string {
  if (action === "created") {
    return "Vertrag angelegt";
  }
  if (action === "signed") {
    return "Digital unterschrieben und PDF erstellt";
  }
  if (action === "revised") {
    return "Vertrag überarbeitet und neue PDF-Version erstellt";
  }
  if (action === "pdf_version") {
    return "Neue PDF-Version erstellt";
  }
  if (action === "employer_signed") {
    return "Arbeitgeber-Unterschrift — wartet auf Mitarbeiter";
  }
  if (action === "employee_signed") {
    return "Mitarbeiter-Unterschrift im Profil";
  }
  if (changes.length === 0) {
    return "Gespeichert (keine Feldänderungen)";
  }
  return changes.map((c) => `${c.label}: „${c.from ?? "—"}“ → „${c.to ?? "—"}“`).join(" · ");
}

export function formatStaffContractLogActorLabel(
  details: StaffContractLogDetails,
  fallback = "Unbekannt",
): string {
  const name = [details.actorGivenName?.trim(), details.actorFamilyName?.trim()]
    .filter(Boolean)
    .join(" ");
  return name || fallback;
}

export async function insertStaffContractLogEntry(
  restaurantId: string,
  contractId: string,
  action: StaffContractLogAction,
  changes: StaffContractLogChange[],
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
    summary: formatStaffContractLogSummary(action, changes),
  };

  const { error } = await supabase
    .from("restaurant_staff_contract_log_entries")
    .insert({
      restaurant_id: restaurantId,
      contract_id: contractId,
      actor_user_id: user.id,
      action,
      details,
    });

  if (error) {
    console.warn("[gwada] restaurant_staff_contract_log_entries", error.message);
  }
}
