import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildStaffProfileChangeDiff,
  emptyStaffProfileChangeFields,
  normalizeStaffProfileFieldValue,
  parseStaffProfileChangeFields,
  staffProfileFieldsEqual,
  STAFF_PROFILE_CHANGE_FIELD_KEYS,
  STAFF_PROFILE_CHANGE_FIELD_LABELS,
  type StaffProfileChangeFieldKey,
  type StaffProfileChangeFields,
  type StaffProfileChangeRequestStatus,
} from "@/lib/staff/staff-profile-change-request-types";
import { formatStaffAuditLogSummary } from "@/lib/staff/staff-log";
import type { StaffAuditLogChange } from "@/lib/types/staff";

export type StaffProfileChangeRequestRow = {
  id: string;
  restaurant_id: string;
  staff_id: string;
  previous_fields: StaffProfileChangeFields;
  proposed_fields: StaffProfileChangeFields;
  status: StaffProfileChangeRequestStatus;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  display_acknowledged_at: string | null;
  created_at: string;
  updated_at: string;
};

export type StaffProfileChangeRequestListItem = StaffProfileChangeRequestRow & {
  staff: {
    given_name: string;
    family_name: string;
    avatar_storage_path: string | null;
  };
};

function mapRequestRow(raw: Record<string, unknown>): StaffProfileChangeRequestRow {
  const previous =
    parseStaffProfileChangeFields(raw.previous_fields) ??
    emptyStaffProfileChangeFields();
  const proposed =
    parseStaffProfileChangeFields(raw.proposed_fields) ??
    emptyStaffProfileChangeFields();
  return {
    id: String(raw.id),
    restaurant_id: String(raw.restaurant_id),
    staff_id: String(raw.staff_id),
    previous_fields: previous,
    proposed_fields: proposed,
    status: raw.status as StaffProfileChangeRequestStatus,
    review_note: (raw.review_note as string | null) ?? null,
    reviewed_by: (raw.reviewed_by as string | null) ?? null,
    reviewed_at: (raw.reviewed_at as string | null) ?? null,
    display_acknowledged_at:
      (raw.display_acknowledged_at as string | null) ?? null,
    created_at: String(raw.created_at),
    updated_at: String(raw.updated_at),
  };
}

export async function loadStaffProfileChangeSnapshot(
  admin: SupabaseClient,
  params: { restaurantId: string; staffId: string },
): Promise<StaffProfileChangeFields | null> {
  const { data, error } = await admin
    .from("restaurant_staff")
    .select(
      `
      given_name,
      family_name,
      birth_date,
      nationality,
      address_line1,
      address_line2,
      postal_code,
      city,
      country,
      email,
      phone
    `,
    )
    .eq("id", params.staffId)
    .eq("restaurant_id", params.restaurantId)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as Record<string, unknown>;
  const out = emptyStaffProfileChangeFields();
  for (const key of STAFF_PROFILE_CHANGE_FIELD_KEYS) {
    out[key] = normalizeStaffProfileFieldValue(key, row[key]);
  }
  // Namen sind NOT NULL in der DB — leere Strings als null behandeln für Diff,
  // aber beim Speichern wieder als Trim-String setzen.
  out.given_name = normalizeStaffProfileFieldValue(
    "given_name",
    row.given_name,
  );
  out.family_name = normalizeStaffProfileFieldValue(
    "family_name",
    row.family_name,
  );
  return out;
}

export function sanitizeProposedStaffProfileFields(
  raw: unknown,
):
  | { ok: true; fields: StaffProfileChangeFields }
  | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "invalid_fields" };
  }
  const obj = raw as Record<string, unknown>;
  const fields = emptyStaffProfileChangeFields();
  for (const key of STAFF_PROFILE_CHANGE_FIELD_KEYS) {
    if (!(key in obj)) continue;
    const value = obj[key];
    if (value == null || value === "") {
      fields[key] = null;
      continue;
    }
    const normalized = normalizeStaffProfileFieldValue(key, value);
    if (key === "birth_date" && typeof value === "string" && value.trim() && !normalized) {
      return { ok: false, error: "invalid_birth_date" };
    }
    fields[key] = normalized;
  }

  const given = fields.given_name?.trim() ?? "";
  const family = fields.family_name?.trim() ?? "";
  if (!given || !family) {
    return { ok: false, error: "name_required" };
  }
  fields.given_name = given;
  fields.family_name = family;

  if (fields.email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
      return { ok: false, error: "invalid_email" };
    }
  }

  if (!fields.country) {
    fields.country = "DE";
  }

  return { ok: true, fields };
}

export async function findPendingStaffProfileChangeRequest(
  admin: SupabaseClient,
  staffId: string,
): Promise<StaffProfileChangeRequestRow | null> {
  const { data } = await admin
    .from("restaurant_staff_profile_change_requests")
    .select("*")
    .eq("staff_id", staffId)
    .eq("status", "pending")
    .maybeSingle();

  if (!data) return null;
  return mapRequestRow(data as Record<string, unknown>);
}

export async function listUnacknowledgedStaffProfileChangeResolutions(
  admin: SupabaseClient,
  staffId: string,
): Promise<StaffProfileChangeRequestRow[]> {
  const { data } = await admin
    .from("restaurant_staff_profile_change_requests")
    .select("*")
    .eq("staff_id", staffId)
    .in("status", ["approved", "declined"])
    .is("display_acknowledged_at", null)
    .order("reviewed_at", { ascending: false })
    .limit(5);

  return ((data as Record<string, unknown>[] | null) ?? []).map(mapRequestRow);
}

export async function listPendingStaffProfileChangeRequestsForRestaurant(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<StaffProfileChangeRequestListItem[]> {
  const { data, error } = await admin
    .from("restaurant_staff_profile_change_requests")
    .select(
      `
      *,
      staff:restaurant_staff (
        given_name,
        family_name,
        avatar_storage_path
      )
    `,
    )
    .eq("restaurant_id", restaurantId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("[gwada] list profile change requests", error.message);
    return [];
  }

  return (data ?? [])
    .map((row) => {
      const staffRaw = (row as Record<string, unknown>).staff;
      const staffOne = Array.isArray(staffRaw) ? staffRaw[0] : staffRaw;
      if (!staffOne || typeof staffOne !== "object") return null;
      const staff = staffOne as {
        given_name: string;
        family_name: string;
        avatar_storage_path: string | null;
      };
      const { staff: _omit, ...request } = row as Record<string, unknown>;
      return {
        ...mapRequestRow(request),
        staff,
      };
    })
    .filter((row): row is StaffProfileChangeRequestListItem => row != null);
}

export async function createStaffProfileChangeRequest(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    staffId: string;
    proposed: StaffProfileChangeFields;
  },
): Promise<
  | { ok: true; request: StaffProfileChangeRequestRow }
  | { ok: false; error: string; status: number }
> {
  const pending = await findPendingStaffProfileChangeRequest(
    admin,
    params.staffId,
  );
  if (pending) {
    return { ok: false, error: "already_pending", status: 409 };
  }

  const previous = await loadStaffProfileChangeSnapshot(admin, {
    restaurantId: params.restaurantId,
    staffId: params.staffId,
  });
  if (!previous) {
    return { ok: false, error: "staff_not_found", status: 404 };
  }

  if (staffProfileFieldsEqual(previous, params.proposed)) {
    return { ok: false, error: "no_changes", status: 400 };
  }

  const { data, error } = await admin
    .from("restaurant_staff_profile_change_requests")
    .insert({
      restaurant_id: params.restaurantId,
      staff_id: params.staffId,
      previous_fields: previous,
      proposed_fields: params.proposed,
      status: "pending",
    })
    .select("*")
    .single();

  if (error || !data) {
    console.warn("[gwada] create profile change request", error?.message);
    if (error?.code === "23505") {
      return { ok: false, error: "already_pending", status: 409 };
    }
    return { ok: false, error: "create_failed", status: 500 };
  }

  const request = mapRequestRow(data as Record<string, unknown>);
  const diff = buildStaffProfileChangeDiff(previous, params.proposed);

  await admin.from("notification_events").insert({
    restaurant_id: params.restaurantId,
    module: "staff_profile_change_request",
    reference_id: request.id,
    payload: {
      requestId: request.id,
      staffId: params.staffId,
      changedFields: diff.map((d) => d.key),
      changeCount: diff.length,
    },
  });

  return { ok: true, request };
}

export async function acknowledgeStaffProfileChangeResolutions(
  admin: SupabaseClient,
  params: {
    staffId: string;
    requestIds: string[];
  },
): Promise<void> {
  if (params.requestIds.length === 0) return;
  const now = new Date().toISOString();
  await admin
    .from("restaurant_staff_profile_change_requests")
    .update({ display_acknowledged_at: now })
    .eq("staff_id", params.staffId)
    .in("id", params.requestIds)
    .is("display_acknowledged_at", null);
}

function proposedToStaffUpdate(
  proposed: StaffProfileChangeFields,
): Record<string, string | null> {
  return {
    given_name: proposed.given_name ?? "",
    family_name: proposed.family_name ?? "",
    birth_date: proposed.birth_date,
    nationality: proposed.nationality,
    address_line1: proposed.address_line1,
    address_line2: proposed.address_line2,
    postal_code: proposed.postal_code,
    city: proposed.city,
    country: proposed.country ?? "DE",
    email: proposed.email,
    phone: proposed.phone,
  };
}

function buildAuditChangesFromDiff(
  previous: StaffProfileChangeFields,
  proposed: StaffProfileChangeFields,
): StaffAuditLogChange[] {
  return buildStaffProfileChangeDiff(previous, proposed).map((item) => ({
    field: item.key,
    label: item.label,
    from: item.fromLabel,
    to: item.toLabel,
  }));
}

async function insertProfileChangeAuditLog(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    staffId: string;
    actorUserId: string;
    previous: StaffProfileChangeFields;
    proposed: StaffProfileChangeFields;
  },
): Promise<void> {
  const changes = buildAuditChangesFromDiff(params.previous, params.proposed);
  const { data: profile } = await admin
    .from("profiles")
    .select("given_name, family_name")
    .eq("id", params.actorUserId)
    .maybeSingle();

  const details = {
    actorGivenName: (profile?.given_name as string | null) ?? "",
    actorFamilyName: (profile?.family_name as string | null) ?? "",
    changes,
    summary: `Display-Profil übernommen · ${formatStaffAuditLogSummary("updated", changes)}`,
    source: "display_profile_change_request",
  };

  const { error } = await admin.from("restaurant_staff_log_entries").insert({
    restaurant_id: params.restaurantId,
    staff_id: params.staffId,
    actor_user_id: params.actorUserId,
    action: "updated",
    details,
  });

  if (error) {
    console.warn("[gwada] profile change audit log", error.message);
  }
}

export async function reviewStaffProfileChangeRequest(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    requestId: string;
    actorUserId: string;
    decision: "approve" | "decline";
    reviewNote?: string | null;
  },
): Promise<
  | { ok: true; request: StaffProfileChangeRequestRow }
  | { ok: false; error: string; status: number }
> {
  const { data: row, error: loadErr } = await admin
    .from("restaurant_staff_profile_change_requests")
    .select("*")
    .eq("id", params.requestId)
    .eq("restaurant_id", params.restaurantId)
    .maybeSingle();

  if (loadErr || !row) {
    return { ok: false, error: "not_found", status: 404 };
  }

  const request = mapRequestRow(row as Record<string, unknown>);
  if (request.status !== "pending") {
    return { ok: false, error: "not_pending", status: 409 };
  }

  const now = new Date().toISOString();
  const note =
    typeof params.reviewNote === "string" && params.reviewNote.trim()
      ? params.reviewNote.trim().slice(0, 500)
      : null;

  if (params.decision === "decline") {
    const { data: declined, error } = await admin
      .from("restaurant_staff_profile_change_requests")
      .update({
        status: "declined",
        review_note: note,
        reviewed_by: params.actorUserId,
        reviewed_at: now,
      })
      .eq("id", params.requestId)
      .eq("status", "pending")
      .select("*")
      .single();

    if (error || !declined) {
      return { ok: false, error: "update_failed", status: 500 };
    }
    return { ok: true, request: mapRequestRow(declined as Record<string, unknown>) };
  }

  // Approve: aktuelle DB nochmal lesen und proposed anwenden (nicht stale previous).
  const live = await loadStaffProfileChangeSnapshot(admin, {
    restaurantId: params.restaurantId,
    staffId: request.staff_id,
  });
  if (!live) {
    return { ok: false, error: "staff_not_found", status: 404 };
  }

  const patch = proposedToStaffUpdate(request.proposed_fields);
  const { error: staffErr } = await admin
    .from("restaurant_staff")
    .update(patch)
    .eq("id", request.staff_id)
    .eq("restaurant_id", params.restaurantId);

  if (staffErr) {
    console.warn("[gwada] approve profile change staff update", staffErr.message);
    return { ok: false, error: "staff_update_failed", status: 500 };
  }

  const { data: approved, error: approveErr } = await admin
    .from("restaurant_staff_profile_change_requests")
    .update({
      status: "approved",
      review_note: note,
      reviewed_by: params.actorUserId,
      reviewed_at: now,
      // Diff-Basis fürs Protokoll: Stand vor Übernahme
      previous_fields: live,
    })
    .eq("id", params.requestId)
    .eq("status", "pending")
    .select("*")
    .single();

  if (approveErr || !approved) {
    return { ok: false, error: "update_failed", status: 500 };
  }

  await insertProfileChangeAuditLog(admin, {
    restaurantId: params.restaurantId,
    staffId: request.staff_id,
    actorUserId: params.actorUserId,
    previous: live,
    proposed: request.proposed_fields,
  });

  return {
    ok: true,
    request: mapRequestRow(approved as Record<string, unknown>),
  };
}

export function countChangedProfileFields(
  previous: StaffProfileChangeFields,
  proposed: StaffProfileChangeFields,
): number {
  return buildStaffProfileChangeDiff(previous, proposed).length;
}

export function profileChangeFieldLabel(
  key: StaffProfileChangeFieldKey,
): string {
  return STAFF_PROFILE_CHANGE_FIELD_LABELS[key];
}
