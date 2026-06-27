import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { staffDisplayName } from "@/lib/types/staff";
import type {
  ComplianceChecklistUpsertInput,
  ComplianceDeviceUpsertInput,
  ComplianceLogAction,
  ComplianceRecordUpsertInput,
  RestaurantComplianceChecklistRow,
  RestaurantComplianceDeviceRow,
  RestaurantComplianceLogEntry,
  RestaurantComplianceRecordRow,
  RestaurantComplianceSettingsRow,
} from "@/lib/types/compliance";
import { evaluateComplianceRecordValues } from "@/lib/compliance/compliance-utils";
import {
  inferLegacyAssigneeType,
} from "@/lib/staff/assignee-matching";

function mapError(error: { message: string } | null): string | null {
  if (!error) return null;
  return error.message;
}

const CHECKLIST_SELECT = `
  *,
  staff:restaurant_staff!restaurant_compliance_checklists_staff_id_fkey (
    id,
    given_name,
    family_name
  ),
  position_tag:restaurant_staff_position_tags!restaurant_compliance_checklists_position_tag_id_fkey (
    id,
    name
  ),
  staff_assignees:restaurant_compliance_checklist_staff_assignees (
    staff_id,
    staff:restaurant_staff (
      id,
      given_name,
      family_name
    )
  ),
  position_assignees:restaurant_compliance_checklist_position_assignees (
    position_tag_id,
    position_tag:restaurant_staff_position_tags (
      id,
      name
    )
  )
`;

const RECORD_SELECT = `
  *,
  checklist:restaurant_compliance_checklists ( id, name, category, items ),
  staff:restaurant_staff!restaurant_compliance_records_performed_by_staff_id_fkey (
    id,
    given_name,
    family_name
  ),
  profile:profiles!restaurant_compliance_records_performed_by_user_id_fkey (
    id,
    display_name
  )
`;

const LOG_SELECT = `
  *,
  checklist:restaurant_compliance_checklists ( id, name ),
  actor_profile:profiles!restaurant_compliance_log_entries_actor_user_id_fkey (
    id,
    display_name
  ),
  actor_staff:restaurant_staff!restaurant_compliance_log_entries_actor_staff_id_fkey (
    id,
    given_name,
    family_name
  )
`;

export async function fetchComplianceDevices(
  restaurantId: string,
  options?: { includeArchived?: boolean },
): Promise<{ data: RestaurantComplianceDeviceRow[]; error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  let query = supabase
    .from("restaurant_compliance_devices")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (!options?.includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query;
  return {
    data: (data ?? []) as RestaurantComplianceDeviceRow[],
    error: mapError(error),
  };
}

export async function upsertComplianceDevice(
  restaurantId: string,
  input: ComplianceDeviceUpsertInput,
  deviceId?: string | null,
): Promise<{ data: RestaurantComplianceDeviceRow | null; error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const payload = {
    restaurant_id: restaurantId,
    name: input.name.trim(),
    device_type: input.deviceType,
    location: input.location?.trim() || null,
    target_min: input.targetMin ?? null,
    target_max: input.targetMax ?? null,
    is_active: input.isActive ?? true,
    sort_order: input.sortOrder ?? 0,
  };

  const { data, error } = deviceId
    ? await supabase
        .from("restaurant_compliance_devices")
        .update(payload)
        .eq("id", deviceId)
        .eq("restaurant_id", restaurantId)
        .select("*")
        .single()
    : await supabase
        .from("restaurant_compliance_devices")
        .insert(payload)
        .select("*")
        .single();

  if (!error && data) {
    await insertComplianceLogEntry({
      restaurantId,
      action: deviceId ? "device_updated" : "device_created",
      deviceId: data.id,
      details: { name: data.name },
    });
  }

  return {
    data: (data as RestaurantComplianceDeviceRow | null) ?? null,
    error: mapError(error),
  };
}

export async function archiveComplianceDevice(
  restaurantId: string,
  deviceId: string,
): Promise<{ error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("restaurant_compliance_devices")
    .update({ archived_at: new Date().toISOString(), is_active: false })
    .eq("id", deviceId)
    .eq("restaurant_id", restaurantId);

  if (!error) {
    await insertComplianceLogEntry({
      restaurantId,
      action: "device_archived",
      deviceId,
      details: {},
    });
  }

  return { error: mapError(error) };
}

export async function fetchComplianceChecklists(
  restaurantId: string,
  options?: { includeArchived?: boolean; displayOnly?: boolean },
): Promise<{ data: RestaurantComplianceChecklistRow[]; error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  let query = supabase
    .from("restaurant_compliance_checklists")
    .select(CHECKLIST_SELECT)
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (!options?.includeArchived) {
    query = query.is("archived_at", null);
  }
  if (options?.displayOnly) {
    query = query.eq("show_on_display", true).eq("is_active", true);
  }

  const { data, error } = await query;
  return {
    data: (data ?? []) as RestaurantComplianceChecklistRow[],
    error: mapError(error),
  };
}

async function syncComplianceChecklistAssignees(
  checklistId: string,
  staffIds: string[],
  positionTagIds: string[],
): Promise<{ error: string | null }> {
  const supabase = createSupabaseBrowserClient();

  const { error: delStaffErr } = await supabase
    .from("restaurant_compliance_checklist_staff_assignees")
    .delete()
    .eq("checklist_id", checklistId);
  if (delStaffErr) return { error: mapError(delStaffErr) };

  const { error: delTagErr } = await supabase
    .from("restaurant_compliance_checklist_position_assignees")
    .delete()
    .eq("checklist_id", checklistId);
  if (delTagErr) return { error: mapError(delTagErr) };

  if (staffIds.length > 0) {
    const { error } = await supabase
      .from("restaurant_compliance_checklist_staff_assignees")
      .insert(staffIds.map((staff_id) => ({ checklist_id: checklistId, staff_id })));
    if (error) return { error: mapError(error) };
  }

  if (positionTagIds.length > 0) {
    const { error } = await supabase
      .from("restaurant_compliance_checklist_position_assignees")
      .insert(
        positionTagIds.map((position_tag_id) => ({
          checklist_id: checklistId,
          position_tag_id,
        })),
      );
    if (error) return { error: mapError(error) };
  }

  return { error: null };
}

export async function upsertComplianceChecklist(
  restaurantId: string,
  input: ComplianceChecklistUpsertInput,
  checklistId?: string | null,
): Promise<{ data: RestaurantComplianceChecklistRow | null; error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const staffIds = [...new Set(input.staffIds ?? [])];
  const positionTagIds = [...new Set(input.positionTagIds ?? [])];
  const assigneeType = inferLegacyAssigneeType(staffIds, positionTagIds);

  const payload = {
    restaurant_id: restaurantId,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    category: input.category,
    frequency: input.frequency,
    items: input.items,
    show_on_display: input.showOnDisplay ?? true,
    is_active: input.isActive ?? true,
    sort_order: input.sortOrder ?? 0,
    assignee_type: assigneeType,
    staff_id: staffIds.length === 1 && positionTagIds.length === 0 ? staffIds[0]! : null,
    position_tag_id:
      positionTagIds.length === 1 && staffIds.length === 0 ? positionTagIds[0]! : null,
    priority: input.priority ?? "medium",
    display_from: input.displayFrom ?? null,
    display_until: input.displayUntil ?? null,
    show_before_clock_in: input.showBeforeClockIn ?? false,
    show_before_break_start: input.showBeforeBreakStart ?? false,
    show_before_break_end: input.showBeforeBreakEnd ?? false,
    show_before_clock_out: input.showBeforeClockOut ?? false,
    show_on_pin_login: input.showOnPinLogin ?? false,
    require_defer_reason: input.requireDeferReason ?? false,
    blocks_shift_end: input.blocksShiftEnd ?? false,
    platform_template_id: input.platformTemplateId ?? null,
    imported_platform_version: input.importedPlatformVersion ?? null,
  };

  let savedId = checklistId ?? null;
  let saveError: { message: string } | null = null;

  if (checklistId) {
    const { data, error } = await supabase
      .from("restaurant_compliance_checklists")
      .update(payload)
      .eq("id", checklistId)
      .eq("restaurant_id", restaurantId)
      .select("id")
      .single();
    saveError = error;
    savedId = (data as { id: string } | null)?.id ?? checklistId;
  } else {
    const { data, error } = await supabase
      .from("restaurant_compliance_checklists")
      .insert(payload)
      .select("id")
      .single();
    saveError = error;
    savedId = (data as { id: string } | null)?.id ?? null;
  }

  if (saveError || !savedId) {
    return { data: null, error: mapError(saveError) };
  }

  const sync = await syncComplianceChecklistAssignees(savedId, staffIds, positionTagIds);
  if (sync.error) {
    return { data: null, error: sync.error };
  }

  const { data, error } = await supabase
    .from("restaurant_compliance_checklists")
    .select(CHECKLIST_SELECT)
    .eq("id", savedId)
    .single();

  if (!error && data) {
    await insertComplianceLogEntry({
      restaurantId,
      action: checklistId ? "checklist_updated" : "checklist_created",
      checklistId: data.id,
      details: { name: data.name, category: data.category },
    });
  }

  return {
    data: (data as RestaurantComplianceChecklistRow | null) ?? null,
    error: mapError(error),
  };
}

export async function archiveComplianceChecklist(
  restaurantId: string,
  checklistId: string,
): Promise<{ error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("restaurant_compliance_checklists")
    .update({ archived_at: new Date().toISOString(), is_active: false })
    .eq("id", checklistId)
    .eq("restaurant_id", restaurantId);

  if (!error) {
    await insertComplianceLogEntry({
      restaurantId,
      action: "checklist_archived",
      checklistId,
      details: {},
    });
  }

  return { error: mapError(error) };
}

export async function fetchComplianceRecords(
  restaurantId: string,
  options?: { checklistId?: string; limit?: number },
): Promise<{ data: RestaurantComplianceRecordRow[]; error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  let query = supabase
    .from("restaurant_compliance_records")
    .select(RECORD_SELECT)
    .eq("restaurant_id", restaurantId)
    .order("performed_at", { ascending: false });

  if (options?.checklistId) {
    query = query.eq("checklist_id", options.checklistId);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  return {
    data: (data ?? []) as RestaurantComplianceRecordRow[],
    error: mapError(error),
  };
}

export async function createComplianceRecord(
  restaurantId: string,
  input: ComplianceRecordUpsertInput,
  checklistItems: ComplianceChecklistUpsertInput["items"],
): Promise<{ data: RestaurantComplianceRecordRow | null; error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const { hasDeviation, normalized } = evaluateComplianceRecordValues(
    checklistItems,
    input.values,
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const payload = {
    restaurant_id: restaurantId,
    checklist_id: input.checklistId,
    performed_at: input.performedAt ?? new Date().toISOString(),
    performed_by_staff_id: input.performedByStaffId ?? null,
    performed_by_user_id: user?.id ?? null,
    values: normalized,
    corrective_action: input.correctiveAction?.trim() || null,
    notes: input.notes?.trim() || null,
    has_deviation: hasDeviation,
    source: input.source ?? "dashboard",
  };

  const { data, error } = await supabase
    .from("restaurant_compliance_records")
    .insert(payload)
    .select(RECORD_SELECT)
    .single();

  if (!error && data) {
    await insertComplianceLogEntry({
      restaurantId,
      action: "record_created",
      checklistId: input.checklistId,
      recordId: data.id,
      details: {
        has_deviation: hasDeviation,
        source: payload.source,
      },
    });
  }

  return {
    data: (data as RestaurantComplianceRecordRow | null) ?? null,
    error: mapError(error),
  };
}

export async function fetchComplianceLogEntries(
  restaurantId: string,
): Promise<{ data: RestaurantComplianceLogEntry[]; error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("restaurant_compliance_log_entries")
    .select(LOG_SELECT)
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(500);

  return {
    data: (data ?? []) as RestaurantComplianceLogEntry[],
    error: mapError(error),
  };
}

export async function insertComplianceLogEntry(params: {
  restaurantId: string;
  action: ComplianceLogAction;
  checklistId?: string | null;
  recordId?: string | null;
  deviceId?: string | null;
  actorStaffId?: string | null;
  details?: Record<string, unknown>;
}): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from("restaurant_compliance_log_entries").insert({
    restaurant_id: params.restaurantId,
    checklist_id: params.checklistId ?? null,
    record_id: params.recordId ?? null,
    device_id: params.deviceId ?? null,
    action: params.action,
    actor_user_id: user?.id ?? null,
    actor_staff_id: params.actorStaffId ?? null,
    details: params.details ?? {},
  });
}

export async function fetchComplianceSettings(
  restaurantId: string,
): Promise<{ data: RestaurantComplianceSettingsRow | null; error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("restaurant_compliance_settings")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  return {
    data: (data as RestaurantComplianceSettingsRow | null) ?? null,
    error: mapError(error),
  };
}

export async function upsertComplianceSettings(
  restaurantId: string,
  input: {
    /** Standard für neue Temperatur-ToDos — wirkt nicht rückwirkend auf bestehende ToDos. */
    requireCorrectiveOnDeviation?: boolean;
    showDueReminders?: boolean;
  },
): Promise<{ error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const row: Record<string, unknown> = { restaurant_id: restaurantId };
  if (input.requireCorrectiveOnDeviation !== undefined) {
    row.require_corrective_on_deviation = input.requireCorrectiveOnDeviation;
  }
  if (input.showDueReminders !== undefined) {
    row.show_due_reminders = input.showDueReminders;
  }
  const { error } = await supabase
    .from("restaurant_compliance_settings")
    .upsert(row, { onConflict: "restaurant_id" });
  return { error: mapError(error) };
}

export async function seedDefaultComplianceTemplates(
  restaurantId: string,
): Promise<{ created: number; error: string | null }> {
  const { data: existing } = await fetchComplianceChecklists(restaurantId);
  if (existing.length > 0) {
    return { created: 0, error: null };
  }

  const supabase = createSupabaseBrowserClient();
  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("country")
    .eq("id", restaurantId)
    .maybeSingle();

  const { resolveRestaurantCountryCode, mapPlatformItemsForRestaurantImport } =
    await import("@/lib/compliance/compliance-platform-import");

  const countryCode = resolveRestaurantCountryCode(
    typeof restaurant?.country === "string" ? restaurant.country : null,
  );

  const { data: platformRows, error: platformError } = await supabase
    .from("platform_compliance_checklist_templates")
    .select("*")
    .eq("country_code", countryCode)
    .eq("is_active", true)
    .order("sort_order")
    .order("name");

  if (platformError) {
    return { created: 0, error: platformError.message };
  }

  const { data: devices } = await fetchComplianceDevices(restaurantId);
  const deviceIds = (devices ?? []).map((d) => d.id);

  let templates: Array<{
    name: string;
    description: string;
    category: import("@/lib/types/compliance").ComplianceCategory;
    frequency: import("@/lib/types/compliance").ComplianceFrequency;
    items: import("@/lib/types/compliance").ComplianceChecklistItem[];
    showOnDisplay: boolean;
    platformTemplateId?: string;
    importedPlatformVersion?: number;
  }> = [];

  if (platformRows?.length) {
    templates = platformRows.map((row) => {
      const platformTemplate = {
        id: row.id as string,
        countryCode: row.country_code as string,
        name: row.name as string,
        description: (row.description as string | null) ?? null,
        category: row.category as import("@/lib/types/compliance").ComplianceCategory,
        frequency: row.frequency as import("@/lib/types/compliance").ComplianceFrequency,
        items: (row.items ?? []) as import("@/lib/types/compliance").ComplianceChecklistItem[],
        showOnDisplay: Boolean(row.show_on_display),
        version: Number(row.version),
        sortOrder: Number(row.sort_order),
        isActive: Boolean(row.is_active),
        createdAt: "",
        updatedAt: "",
      };
      return {
        name: platformTemplate.name,
        description: platformTemplate.description ?? "",
        category: platformTemplate.category,
        frequency: platformTemplate.frequency,
        items: mapPlatformItemsForRestaurantImport(platformTemplate, deviceIds),
        showOnDisplay: platformTemplate.showOnDisplay,
        platformTemplateId: platformTemplate.id,
        importedPlatformVersion: platformTemplate.version,
      };
    });
  } else {
    const { buildDefaultComplianceTemplates } = await import(
      "@/lib/compliance/compliance-utils"
    );
    templates = buildDefaultComplianceTemplates(deviceIds).map((t) => ({
      ...t,
      platformTemplateId: undefined,
      importedPlatformVersion: undefined,
    }));
  }

  let created = 0;
  for (const [index, template] of templates.entries()) {
    const { error } = await upsertComplianceChecklist(restaurantId, {
      name: template.name,
      description: template.description,
      category: template.category,
      frequency: template.frequency,
      items: template.items,
      showOnDisplay: template.showOnDisplay,
      sortOrder: index,
      platformTemplateId: template.platformTemplateId ?? null,
      importedPlatformVersion: template.importedPlatformVersion ?? null,
    });
    if (error) return { created, error };
    created += 1;
  }

  await insertComplianceLogEntry({
    restaurantId,
    action: "templates_seeded",
    details: { count: created },
  });

  return { created, error: null };
}

export function resolveComplianceRecordActorLabel(
  row: RestaurantComplianceRecordRow,
): string {
  if (row.staff) return staffDisplayName(row.staff);
  if (row.profile?.display_name?.trim()) return row.profile.display_name.trim();
  return "—";
}

export function resolveComplianceLogActorLabel(
  entry: RestaurantComplianceLogEntry,
): string {
  if (entry.actor_staff) return staffDisplayName(entry.actor_staff);
  if (entry.actor_profile?.display_name?.trim()) {
    return entry.actor_profile.display_name.trim();
  }
  return "—";
}

export function formatComplianceLogDetailsSummary(
  entry: RestaurantComplianceLogEntry,
): string {
  const d = entry.details;
  if (entry.action === "deferred" && typeof d.trigger === "string") {
    return `Verschoben (${d.trigger})`;
  }
  if (entry.action === "templates_seeded" && typeof d.count === "number") {
    return `${d.count} Vorlagen`;
  }
  if (typeof d.name === "string") return d.name;
  if (entry.checklist?.name) return entry.checklist.name;
  if (d.has_deviation === true) return "Mit Abweichung";
  return "";
}
