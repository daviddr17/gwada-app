import {
  formatComplianceLogDetailsSummary,
  resolveComplianceLogActorLabel,
  resolveComplianceRecordActorLabel,
} from "@/lib/supabase/compliance-db";
import {
  formatStaffTodoLogDetails,
  resolveStaffTodoLogActorLabel,
  type StaffTodoCompletionForProtocol,
  type StaffTodoLogEntryForProtocol,
} from "@/lib/supabase/staff-todos-db";
import { staffDisplayName } from "@/lib/types/staff";
import type { RestaurantComplianceLogEntry } from "@/lib/types/compliance";
import type { RestaurantComplianceRecordRow } from "@/lib/types/compliance";
import { COMPLIANCE_LOG_ACTION_LABELS } from "@/lib/types/compliance";
import { STAFF_TODO_LOG_ACTION_LABELS } from "@/lib/types/staff-todos";

export type ChecklistProtocolKind = "capture" | "change";

export type ChecklistProtocolEntry = {
  id: string;
  kind: ChecklistProtocolKind;
  at: string;
  title: string;
  areaId: string | null;
  areaName: string | null;
  areaColor: string | null;
  deviceId: string | null;
  deviceName: string | null;
  actor: string;
  actionLabel: string;
  details: string;
  withinLimits: boolean | null;
  legacyRecordId?: string;
};

export type ChecklistProtocolKindFilter = "all" | ChecklistProtocolKind;
export type ChecklistProtocolPeriodFilter = "all" | "today" | "7d" | "30d";
export type ChecklistProtocolDeviationFilter = "all" | "deviation" | "ok";
export type ChecklistProtocolSortKey = "newest" | "oldest";

function formatTodoCaptureDetails(
  completion: StaffTodoCompletionForProtocol,
): string {
  const parts: string[] = [];
  const captureType = completion.todo.capture_type;
  if (completion.captured_numeric != null) {
    const suffix = captureType === "temperature" ? " °C" : "";
    parts.push(`${completion.captured_numeric}${suffix}`);
  }
  if (completion.captured_text?.trim()) parts.push(completion.captured_text.trim());
  if (completion.corrective_action?.trim()) {
    parts.push(`Korrektur: ${completion.corrective_action.trim()}`);
  }
  if (completion.completion_note?.trim()) {
    parts.push(completion.completion_note.trim());
  }
  return parts.join(" · ") || "Erledigt";
}

function areaFromTodo(
  todo: StaffTodoCompletionForProtocol["todo"] | StaffTodoLogEntryForProtocol["todo"],
) {
  return {
    areaId: todo?.checklist_area_id ?? todo?.checklist_area?.id ?? null,
    areaName: todo?.checklist_area?.name ?? null,
    areaColor: todo?.checklist_area?.background_color ?? null,
    deviceId: todo?.checklist_device_id ?? todo?.checklist_device?.id ?? null,
    deviceName: todo?.checklist_device?.name ?? null,
  };
}

export function buildChecklistProtocolEntries(input: {
  todoCompletions: StaffTodoCompletionForProtocol[];
  todoLogs: StaffTodoLogEntryForProtocol[];
  complianceRecords: RestaurantComplianceRecordRow[];
  complianceLogs: RestaurantComplianceLogEntry[];
}): ChecklistProtocolEntry[] {
  const entries: ChecklistProtocolEntry[] = [];

  for (const c of input.todoCompletions) {
    const ctx = areaFromTodo(c.todo);
    entries.push({
      id: `todo-completion-${c.id}`,
      kind: "capture",
      at: c.completed_at,
      title: c.todo.title,
      ...ctx,
      actor: c.staff
        ? staffDisplayName({
            given_name: c.staff.given_name,
            family_name: c.staff.family_name ?? "",
          })
        : "—",
      actionLabel: "Erfassung",
      details: formatTodoCaptureDetails(c),
      withinLimits: c.within_limits,
    });
  }

  for (const e of input.todoLogs) {
    const ctx = areaFromTodo(e.todo);
    entries.push({
      id: `todo-log-${e.id}`,
      kind: "change",
      at: e.created_at,
      title: e.todo?.title ?? "—",
      ...ctx,
      actor: resolveStaffTodoLogActorLabel(e),
      actionLabel: STAFF_TODO_LOG_ACTION_LABELS[e.action],
      details: formatStaffTodoLogDetails(e),
      withinLimits: null,
    });
  }

  for (const r of input.complianceRecords) {
    const parts: string[] = [];
    if (r.has_deviation) parts.push("Abweichung");
    if (r.corrective_action?.trim()) parts.push(`Korrektur: ${r.corrective_action.trim()}`);
    if (r.notes?.trim()) parts.push(r.notes.trim());
    entries.push({
      id: `compliance-record-${r.id}`,
      kind: "capture",
      at: r.performed_at,
      title: r.checklist?.name ?? "Checkliste",
      areaId: null,
      areaName: null,
      areaColor: null,
      deviceId: null,
      deviceName: null,
      actor: resolveComplianceRecordActorLabel(r),
      actionLabel: "Erfassung",
      details: parts.join(" · ") || (r.has_deviation ? "Abweichung" : "OK"),
      withinLimits: r.has_deviation ? false : true,
      legacyRecordId: r.id,
    });
  }

  for (const e of input.complianceLogs) {
    entries.push({
      id: `compliance-log-${e.id}`,
      kind: "change",
      at: e.created_at,
      title: e.checklist?.name ?? "—",
      areaId: null,
      areaName: null,
      areaColor: null,
      deviceId: null,
      deviceName: null,
      actor: resolveComplianceLogActorLabel(e),
      actionLabel: COMPLIANCE_LOG_ACTION_LABELS[e.action],
      details: formatComplianceLogDetailsSummary(e),
      withinLimits: null,
    });
  }

  return entries;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function periodStart(period: ChecklistProtocolPeriodFilter): Date | null {
  if (period === "all") return null;
  const now = new Date();
  if (period === "today") return startOfToday();
  const days = period === "7d" ? 7 : 30;
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function filterChecklistProtocolEntries(
  entries: ChecklistProtocolEntry[],
  input: {
    search: string;
    kind: ChecklistProtocolKindFilter;
    period: ChecklistProtocolPeriodFilter;
    areaId: string;
    deviceId: string;
    deviation: ChecklistProtocolDeviationFilter;
    sortKey: ChecklistProtocolSortKey;
  },
): ChecklistProtocolEntry[] {
  const q = input.search.trim().toLowerCase();
  const from = periodStart(input.period);

  let list = entries.filter((e) => {
    if (input.kind !== "all" && e.kind !== input.kind) return false;
    if (from && new Date(e.at) < from) return false;
    if (input.areaId !== "all" && e.areaId !== input.areaId) return false;
    if (input.deviceId !== "all" && e.deviceId !== input.deviceId) return false;
    if (input.deviation === "deviation") {
      if (e.kind !== "capture" || e.withinLimits !== false) return false;
    }
    if (input.deviation === "ok") {
      if (e.kind !== "capture" || e.withinLimits === false) return false;
    }
    if (!q) return true;
    const haystack = [
      e.title,
      e.actor,
      e.actionLabel,
      e.details,
      e.areaName ?? "",
      e.deviceName ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });

  list = [...list].sort((a, b) => {
    const ta = new Date(a.at).getTime();
    const tb = new Date(b.at).getTime();
    return input.sortKey === "oldest" ? ta - tb : tb - ta;
  });

  return list;
}

export function countChecklistProtocolActiveFilters(input: {
  kind: ChecklistProtocolKindFilter;
  period: ChecklistProtocolPeriodFilter;
  areaId: string;
  deviceId: string;
  deviation: ChecklistProtocolDeviationFilter;
  sortKey: ChecklistProtocolSortKey;
}): number {
  let n = 0;
  if (input.kind !== "all") n += 1;
  if (input.period !== "all") n += 1;
  if (input.areaId !== "all") n += 1;
  if (input.deviceId !== "all") n += 1;
  if (input.deviation !== "all") n += 1;
  if (input.sortKey !== "newest") n += 1;
  return n;
}

export const CHECKLIST_PROTOCOL_KIND_OPTIONS: {
  value: ChecklistProtocolKindFilter;
  label: string;
}[] = [
  { value: "all", label: "Alle Typen" },
  { value: "capture", label: "Erfassungen" },
  { value: "change", label: "Änderungen" },
];

export const CHECKLIST_PROTOCOL_PERIOD_OPTIONS: {
  value: ChecklistProtocolPeriodFilter;
  label: string;
}[] = [
  { value: "all", label: "Gesamter Zeitraum" },
  { value: "today", label: "Heute" },
  { value: "7d", label: "Letzte 7 Tage" },
  { value: "30d", label: "Letzte 30 Tage" },
];

export const CHECKLIST_PROTOCOL_DEVIATION_OPTIONS: {
  value: ChecklistProtocolDeviationFilter;
  label: string;
}[] = [
  { value: "all", label: "Alle Ergebnisse" },
  { value: "deviation", label: "Nur Abweichungen" },
  { value: "ok", label: "Nur ohne Abweichung" },
];

export const CHECKLIST_PROTOCOL_SORT_OPTIONS: {
  value: ChecklistProtocolSortKey;
  label: string;
}[] = [
  { value: "newest", label: "Neueste zuerst" },
  { value: "oldest", label: "Älteste zuerst" },
];
