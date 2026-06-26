import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ComplianceChecklistItem,
  ComplianceCategory,
  ComplianceFrequency,
  ComplianceRecordValues,
} from "@/lib/types/compliance";
import { isComplianceChecklistDue } from "@/lib/compliance/compliance-due";
import { isAssignedToStaffMember } from "@/lib/staff/assignee-matching";
import { evaluateComplianceRecordValues } from "@/lib/compliance/compliance-utils";
import {
  displayActionToTrigger,
  triggerShowColumn,
} from "@/lib/staff/staff-todo-display-triggers";
import type { StaffTodoDeferTrigger } from "@/lib/types/staff-todos";

export { displayActionToTrigger } from "@/lib/staff/staff-todo-display-triggers";

type ChecklistRow = {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  category: ComplianceCategory;
  frequency: ComplianceFrequency;
  items: ComplianceChecklistItem[];
  assignee_type: "staff" | "position_tag" | "mixed" | null;
  staff_id: string | null;
  position_tag_id: string | null;
  staff_assignees?: { staff_id: string }[];
  position_assignees?: { position_tag_id: string }[];
  priority: "high" | "medium" | "low";
  display_from: string | null;
  display_until: string | null;
  show_before_clock_in: boolean;
  show_before_break_start: boolean;
  show_before_break_end: boolean;
  show_before_clock_out: boolean;
  show_on_pin_login: boolean;
  require_defer_reason: boolean;
  blocks_shift_end: boolean;
  is_active: boolean;
  archived_at: string | null;
};

type DeferralRow = {
  id: string;
  checklist_id: string;
  staff_id: string;
  trigger_type: StaffTodoDeferTrigger;
  reason: string | null;
  note: string | null;
  deferred_at: string;
  cleared_at: string | null;
};

const CHECKLIST_SELECT = `
  id,
  restaurant_id,
  name,
  description,
  category,
  frequency,
  items,
  assignee_type,
  staff_id,
  position_tag_id,
  staff_assignees:restaurant_compliance_checklist_staff_assignees ( staff_id ),
  position_assignees:restaurant_compliance_checklist_position_assignees ( position_tag_id ),
  priority,
  display_from,
  display_until,
  show_before_clock_in,
  show_before_break_start,
  show_before_break_end,
  show_before_clock_out,
  show_on_pin_login,
  require_defer_reason,
  blocks_shift_end,
  is_active,
  archived_at
`;

export type DisplayComplianceGateItem = {
  id: string;
  name: string;
  description: string | null;
  category: ComplianceCategory;
  frequency: ComplianceFrequency;
  items: ComplianceChecklistItem[];
  require_defer_reason: boolean;
  blocks_shift_end: boolean;
  priority: "high" | "medium" | "low";
};

const PRIORITY_ORDER: Record<DisplayComplianceGateItem["priority"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function mapGateItem(row: ChecklistRow): DisplayComplianceGateItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    frequency: row.frequency,
    items: row.items,
    require_defer_reason: row.require_defer_reason,
    blocks_shift_end: row.blocks_shift_end,
    priority: row.priority,
  };
}

function isWithinDisplayWindow(row: ChecklistRow, ref: Date): boolean {
  if (row.display_from) {
    const from = new Date(row.display_from);
    if (ref < from) return false;
  }
  if (row.display_until) {
    const until = new Date(row.display_until);
    if (ref > until) return false;
  }
  return true;
}

async function loadStaffPositionTagId(
  admin: SupabaseClient,
  staffId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("restaurant_staff")
    .select("position_tag_id")
    .eq("id", staffId)
    .maybeSingle();
  return (data as { position_tag_id: string | null } | null)?.position_tag_id ?? null;
}

function checklistAssignedToStaff(
  row: ChecklistRow,
  staffId: string,
  positionTagId: string | null,
): boolean {
  return isAssignedToStaffMember(row, staffId, positionTagId, {
    emptyMeansAll: true,
  });
}

async function fetchActiveChecklists(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<ChecklistRow[]> {
  const { data, error } = await admin
    .from("restaurant_compliance_checklists")
    .select(CHECKLIST_SELECT)
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true)
    .is("archived_at", null);

  if (error) {
    console.warn("[gwada] compliance gate fetch", error.message);
    return [];
  }
  return (data ?? []) as ChecklistRow[];
}

async function loadLastPerformedMap(
  admin: SupabaseClient,
  restaurantId: string,
  checklistIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (checklistIds.length === 0) return map;

  const { data } = await admin
    .from("restaurant_compliance_records")
    .select("checklist_id, performed_at")
    .eq("restaurant_id", restaurantId)
    .in("checklist_id", checklistIds)
    .order("performed_at", { ascending: false });

  for (const row of (data ?? []) as { checklist_id: string; performed_at: string }[]) {
    if (!map.has(row.checklist_id)) {
      map.set(row.checklist_id, row.performed_at);
    }
  }
  return map;
}

async function loadActiveDeferrals(
  admin: SupabaseClient,
  staffId: string,
  checklistIds: string[],
): Promise<Map<string, DeferralRow>> {
  const map = new Map<string, DeferralRow>();
  if (checklistIds.length === 0) return map;

  const { data } = await admin
    .from("restaurant_compliance_deferrals")
    .select("*")
    .eq("staff_id", staffId)
    .in("checklist_id", checklistIds)
    .is("cleared_at", null);

  for (const row of (data ?? []) as DeferralRow[]) {
    map.set(row.checklist_id, row);
  }
  return map;
}

async function fetchTriggerChecklists(
  admin: SupabaseClient,
  restaurantId: string,
  staffId: string,
  positionTagId: string | null,
  trigger: StaffTodoDeferTrigger,
): Promise<ChecklistRow[]> {
  const col = triggerShowColumn(trigger);
  const rows = await fetchActiveChecklists(admin, restaurantId);
  return rows.filter(
    (c) => c[col] && checklistAssignedToStaff(c, staffId, positionTagId),
  );
}

export async function clearComplianceDeferralsForTrigger(
  admin: SupabaseClient,
  params: { staffId: string; trigger: StaffTodoDeferTrigger },
): Promise<void> {
  await admin
    .from("restaurant_compliance_deferrals")
    .update({ cleared_at: new Date().toISOString() })
    .eq("staff_id", params.staffId)
    .eq("trigger_type", params.trigger)
    .is("cleared_at", null);
}

export async function getComplianceForDisplayTrigger(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    staffId: string;
    trigger: StaffTodoDeferTrigger;
    prepareTrigger?: boolean;
  },
): Promise<DisplayComplianceGateItem[]> {
  if (params.prepareTrigger) {
    await clearComplianceDeferralsForTrigger(admin, {
      staffId: params.staffId,
      trigger: params.trigger,
    });
  }

  const now = new Date();
  const positionTagId = await loadStaffPositionTagId(admin, params.staffId);
  const rows = await fetchTriggerChecklists(
    admin,
    params.restaurantId,
    params.staffId,
    positionTagId,
    params.trigger,
  );
  const ids = rows.map((r) => r.id);
  const [lastPerformed, deferrals] = await Promise.all([
    loadLastPerformedMap(admin, params.restaurantId, ids),
    loadActiveDeferrals(admin, params.staffId, ids),
  ]);

  return rows
    .filter((c) => {
      if (!isWithinDisplayWindow(c, now)) return false;
      const last = lastPerformed.get(c.id) ?? null;
      if (!isComplianceChecklistDue(c, last, now)) return false;
      const deferral = deferrals.get(c.id);
      if (deferral?.trigger_type === params.trigger) return false;
      return true;
    })
    .sort(
      (a, b) =>
        PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
        a.name.localeCompare(b.name, "de"),
    )
    .map(mapGateItem);
}

export async function listDueComplianceChecklistsForRestaurant(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<
  (DisplayComplianceGateItem & { last_performed_at: string | null; frequency: ComplianceFrequency })[]
> {
  const rows = await fetchActiveChecklists(admin, restaurantId);
  const ids = rows.map((r) => r.id);
  const lastPerformed = await loadLastPerformedMap(admin, restaurantId, ids);
  const now = new Date();

  return rows
    .filter((c) => {
      if (!isWithinDisplayWindow(c, now)) return false;
      const last = lastPerformed.get(c.id) ?? null;
      return isComplianceChecklistDue(c, last, now);
    })
    .sort((a, b) => a.name.localeCompare(b.name, "de"))
    .map((c) => ({
      ...mapGateItem(c),
      last_performed_at: lastPerformed.get(c.id) ?? null,
    }));
}

export function complianceTriggerBlocksProceed(
  items: DisplayComplianceGateItem[],
  trigger: StaffTodoDeferTrigger,
): boolean {
  return items.some((c) => c.blocks_shift_end && trigger === "clock_out");
}

export async function completeDisplayComplianceChecklist(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    staffId: string;
    checklistId: string;
    values: ComplianceRecordValues;
    correctiveAction?: string | null;
    notes?: string | null;
  },
): Promise<{ ok: true; has_deviation: boolean } | { ok: false; error: string; status: number }> {
  const { data: checklist } = await admin
    .from("restaurant_compliance_checklists")
    .select("id, items")
    .eq("id", params.checklistId)
    .eq("restaurant_id", params.restaurantId)
    .is("archived_at", null)
    .maybeSingle();

  if (!checklist) {
    return { ok: false, error: "not_found", status: 404 };
  }

  const items = (checklist.items ?? []) as ComplianceChecklistItem[];
  const { hasDeviation, normalized } = evaluateComplianceRecordValues(
    items,
    params.values,
  );

  if (hasDeviation && !params.correctiveAction?.trim()) {
    return { ok: false, error: "corrective_action_required", status: 422 };
  }

  const { data: record, error: recError } = await admin
    .from("restaurant_compliance_records")
    .insert({
      restaurant_id: params.restaurantId,
      checklist_id: params.checklistId,
      performed_by_staff_id: params.staffId,
      values: normalized,
      corrective_action: params.correctiveAction?.trim() || null,
      notes: params.notes?.trim() || null,
      has_deviation: hasDeviation,
      source: "display",
    })
    .select("id")
    .single();

  if (recError) {
    return { ok: false, error: recError.message, status: 500 };
  }

  await admin.from("restaurant_compliance_log_entries").insert({
    restaurant_id: params.restaurantId,
    checklist_id: params.checklistId,
    record_id: record.id,
    action: "record_created",
    actor_staff_id: params.staffId,
    details: { has_deviation: hasDeviation, source: "display_gate" },
  });

  return { ok: true, has_deviation: hasDeviation };
}

export async function deferDisplayComplianceChecklist(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    staffId: string;
    checklistId: string;
    trigger: StaffTodoDeferTrigger;
    reason?: string | null;
    note?: string | null;
  },
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const { data: checklist } = await admin
    .from("restaurant_compliance_checklists")
    .select("id, name, require_defer_reason")
    .eq("id", params.checklistId)
    .eq("restaurant_id", params.restaurantId)
    .is("archived_at", null)
    .maybeSingle();

  if (!checklist) {
    return { ok: false, error: "not_found", status: 404 };
  }

  const row = checklist as {
    name: string;
    require_defer_reason: boolean;
  };

  if (row.require_defer_reason && !params.reason?.trim()) {
    return { ok: false, error: "reason_required", status: 400 };
  }

  const { error: defErr } = await admin
    .from("restaurant_compliance_deferrals")
    .insert({
      checklist_id: params.checklistId,
      staff_id: params.staffId,
      trigger_type: params.trigger,
      reason: params.reason?.trim() || null,
      note: params.note?.trim() || null,
    });

  if (defErr) {
    return { ok: false, error: defErr.message, status: 500 };
  }

  await admin.from("restaurant_compliance_log_entries").insert({
    restaurant_id: params.restaurantId,
    checklist_id: params.checklistId,
    action: "deferred",
    actor_staff_id: params.staffId,
    details: {
      name: row.name,
      trigger: params.trigger,
      reason: params.reason?.trim() || null,
    },
  });

  return { ok: true };
}
