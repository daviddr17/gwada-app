import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { StaffUpsertPayload } from "@/lib/supabase/staff-db";
import type {
  RestaurantStaffRow,
  StaffAuditLogAction,
  StaffAuditLogChange,
  StaffAuditLogDetails,
  StaffPositionTagDefinition,
} from "@/lib/types/staff";

function strOrDash(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Ja" : "Nein";
  return String(v);
}

function tagLabel(
  id: string | null | undefined,
  tags: readonly StaffPositionTagDefinition[],
): string {
  if (!id) return "—";
  return tags.find((t) => t.id === id)?.name ?? "—";
}

function formatBirthYmd(ymd: string | null | undefined): string {
  if (!ymd) return "—";
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(y, m - 1, d));
}

function staffSnapshot(
  row: RestaurantStaffRow | StaffUpsertPayload,
  tags: readonly StaffPositionTagDefinition[],
): Record<string, string> {
  const tagId =
    "position_tag_id" in row ? row.position_tag_id : null;
  const addr = [
    row.address_line1?.trim(),
    row.postal_code?.trim(),
    row.city?.trim(),
  ]
    .filter(Boolean)
    .join(", ");
  return {
    given_name: row.given_name?.trim() ?? "",
    family_name: row.family_name?.trim() ?? "",
    birth_date: formatBirthYmd(row.birth_date ?? null),
    nationality: row.nationality?.trim() || "—",
    address: addr || "—",
    email: row.email?.trim() || "—",
    phone: row.phone?.trim() || "—",
    is_active: strOrDash(row.is_active ?? true),
    position: tagLabel(tagId, tags),
  };
}

const FIELD_LABELS: Record<string, string> = {
  given_name: "Vorname",
  family_name: "Nachname",
  birth_date: "Geburtsdatum",
  nationality: "Nationalität",
  address: "Adresse",
  email: "E-Mail",
  phone: "Telefon",
  is_active: "Status (aktiv)",
  position: "Position",
};

export function buildStaffAuditChanges(
  before: RestaurantStaffRow | null,
  after: StaffUpsertPayload,
  tags: readonly StaffPositionTagDefinition[],
): StaffAuditLogChange[] {
  const afterSnap = staffSnapshot(after, tags);
  const changes: StaffAuditLogChange[] = [];

  if (!before) {
    for (const [field, label] of Object.entries(FIELD_LABELS)) {
      changes.push({
        field,
        label,
        from: null,
        to: afterSnap[field] ?? "—",
      });
    }
    return changes;
  }

  const beforeSnap = staffSnapshot(before, tags);
  for (const [field, label] of Object.entries(FIELD_LABELS)) {
    const from = beforeSnap[field] ?? "—";
    const to = afterSnap[field] ?? "—";
    if (from === to) continue;
    changes.push({ field, label, from, to });
  }
  return changes;
}

export function formatStaffAuditLogActionLabel(
  action: StaffAuditLogAction,
): string {
  if (action === "created") return "Angelegt";
  if (action === "updated") return "Geändert";
  if (action === "invite_email") return "Einladung per E-Mail";
  if (action === "invite_whatsapp") return "Einladung per WhatsApp";
  if (action === "invite_accepted") return "Einladung angenommen";
  if (action === "access_revoked") return "App-Zugang entzogen";
  return "Eintrag";
}

export function formatStaffAuditLogSummary(
  action: StaffAuditLogAction,
  changes: StaffAuditLogChange[],
): string {
  if (action === "created") return "Mitarbeiter angelegt";
  if (action === "invite_email") return "Einladung per E-Mail versendet";
  if (action === "invite_whatsapp") return "Einladung per WhatsApp versendet";
  if (action === "invite_accepted") return "Einladung angenommen";
  if (action === "access_revoked") return "App-Zugang entzogen";
  if (changes.length === 0) return "Gespeichert (keine Feldänderungen)";
  return changes
    .map((c) => `${c.label}: „${c.from ?? "—"}“ → „${c.to ?? "—"}“`)
    .join(" · ");
}

export function formatStaffAuditLogActorLabel(
  details: StaffAuditLogDetails,
  fallback = "Unbekannt",
): string {
  const name = [details.actorGivenName?.trim(), details.actorFamilyName?.trim()]
    .filter(Boolean)
    .join(" ");
  return name || fallback;
}

export async function insertStaffAuditLogEntry(
  restaurantId: string,
  staffId: string,
  action: StaffAuditLogAction,
  changes: StaffAuditLogChange[],
  detailsOverride?: Partial<StaffAuditLogDetails>,
): Promise<{ ok: boolean }> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { data: profile } = await supabase
    .from("profiles")
    .select("given_name, family_name")
    .eq("id", user.id)
    .maybeSingle();

  const details: StaffAuditLogDetails = {
    actorGivenName: (profile?.given_name as string | null) ?? "",
    actorFamilyName: (profile?.family_name as string | null) ?? "",
    changes: detailsOverride?.changes ?? changes,
    summary:
      detailsOverride?.summary ??
      formatStaffAuditLogSummary(action, detailsOverride?.changes ?? changes),
  };

  let rowAction = action;
  let rowDetails = details;

  const insertRow = async () =>
    supabase.from("restaurant_staff_log_entries").insert({
      restaurant_id: restaurantId,
      staff_id: staffId,
      actor_user_id: user.id,
      action: rowAction,
      details: rowDetails,
    });

  let { error } = await insertRow();

  if (
    error &&
    (error.code === "23514" ||
      error.message?.includes("restaurant_staff_log_entries_action_check")) &&
    rowAction !== "updated"
  ) {
    rowAction = "updated";
    rowDetails = {
      ...details,
      summary: `[${action}] ${details.summary ?? ""}`.trim(),
    };
    ({ error } = await insertRow());
  }

  if (error) {
    console.warn("[gwada] restaurant_staff_log_entries", error.message);
    return { ok: false };
  }

  return { ok: true };
}
