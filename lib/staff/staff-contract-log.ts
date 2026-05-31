import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type {
  RestaurantStaffContractRow,
  StaffContractLogAction,
  StaffContractLogChange,
  StaffContractLogDetails,
  StaffContractPayType,
  StaffEmploymentType,
} from "@/lib/types/staff";
import {
  STAFF_CONTRACT_PAY_LABELS,
  STAFF_EMPLOYMENT_LABELS,
} from "@/lib/types/staff";

function formatEuro(cents: number | null): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function displayPaySummary(c: {
  pay_type: StaffContractPayType;
  hourly_rate_cents: number | null;
  fixed_salary_cents: number | null;
}): string {
  if (c.pay_type === "hourly") {
    return `${STAFF_CONTRACT_PAY_LABELS.hourly}: ${formatEuro(c.hourly_rate_cents)}`;
  }
  return `${STAFF_CONTRACT_PAY_LABELS.fixed}: ${formatEuro(c.fixed_salary_cents)}`;
}

function strOrDash(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

export function buildStaffContractChanges(
  before: RestaurantStaffContractRow | null,
  after: Omit<
    RestaurantStaffContractRow,
    "id" | "restaurant_id" | "staff_id"
  >,
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
      after.employment_type
        ? STAFF_EMPLOYMENT_LABELS[after.employment_type]
        : "—",
    );
    push(
      "vacation_days_per_year",
      "Urlaubstage/Jahr",
      null,
      strOrDash(after.vacation_days_per_year),
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

  const empBefore = before.employment_type
    ? STAFF_EMPLOYMENT_LABELS[before.employment_type]
    : "—";
  const empAfter = after.employment_type
    ? STAFF_EMPLOYMENT_LABELS[after.employment_type as StaffEmploymentType]
    : "—";
  push("employment_type", "Beschäftigung", empBefore, empAfter);

  push(
    "vacation_days_per_year",
    "Urlaubstage/Jahr",
    strOrDash(before.vacation_days_per_year),
    strOrDash(after.vacation_days_per_year),
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
