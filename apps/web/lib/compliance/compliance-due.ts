import type {
  ComplianceFrequency,
  RestaurantComplianceChecklistRow,
} from "@/lib/types/compliance";

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfLocalWeek(d: Date): Date {
  const x = startOfLocalDay(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

function startOfLocalMonth(d: Date): Date {
  const x = startOfLocalDay(d);
  x.setDate(1);
  return x;
}

export function compliancePeriodStart(
  frequency: ComplianceFrequency,
  ref: Date = new Date(),
): Date | null {
  switch (frequency) {
    case "daily":
      return startOfLocalDay(ref);
    case "weekly":
      return startOfLocalWeek(ref);
    case "monthly":
      return startOfLocalMonth(ref);
    case "ad_hoc":
      return null;
    default:
      return startOfLocalDay(ref);
  }
}

export function isComplianceChecklistDue(
  checklist: Pick<
    RestaurantComplianceChecklistRow,
    "frequency" | "is_active" | "archived_at"
  >,
  lastPerformedAt: string | null,
  ref: Date = new Date(),
): boolean {
  if (!checklist.is_active || checklist.archived_at) return false;
  if (checklist.frequency === "ad_hoc") return false;

  const periodStart = compliancePeriodStart(checklist.frequency, ref);
  if (periodStart == null) return true;

  if (!lastPerformedAt) return true;
  const last = new Date(lastPerformedAt);
  return last < periodStart;
}

export function listDueComplianceChecklists<
  T extends RestaurantComplianceChecklistRow & { last_performed_at?: string | null },
>(checklists: T[], ref: Date = new Date()): T[] {
  return checklists.filter((c) =>
    isComplianceChecklistDue(c, c.last_performed_at ?? null, ref),
  );
}
