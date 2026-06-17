import { documentLogActionLabel } from "@/lib/types/document-log";
import type { DocumentLogAction } from "@/lib/types/document-log";

function logActionLabel(action: DocumentLogAction): string {
  switch (action) {
    case "note_added":
      return "Notiz hinzugefügt";
    case "note_updated":
      return "Notiz geändert";
    default:
      return documentLogActionLabel(action);
  }
}
import type {
  DocumentAnalyticsRow,
  DocumentLogAnalyticsRow,
} from "@/lib/supabase/documents-analytics-db";

const WEEKDAY_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"] as const;
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export type DocumentStatsPeriod = 3 | 6 | 12;

const ACTION_COLORS: Record<DocumentLogAction, string> = {
  uploaded: "var(--chart-1)",
  updated: "var(--chart-2)",
  deleted: "var(--chart-3)",
  note_updated: "var(--chart-4)",
  note_added: "var(--chart-5)",
};

export type DocumentStatisticsInput = {
  documents: DocumentAnalyticsRow[];
  logEntries: DocumentLogAnalyticsRow[];
  documentsBytes: number;
  periodStart: Date;
  periodEnd: Date;
};

export type DocumentStatisticsResult = {
  totalDocuments: number;
  documentsInPeriod: number;
  documentsBytes: number;
  bytesAddedInPeriod: number;
  withTagCount: number;
  withoutTagCount: number;
  logActionsInPeriod: number;
  uploadsInPeriod: number;
  topTag: string | null;
  topAction: string | null;
  avgFileSizeBytes: number | null;
  byTag: Array<{ name: string; count: number }>;
  byAction: Array<{ action: string; label: string; count: number; fill: string }>;
  byMonth: Array<{ month: string; count: number }>;
  byWeekday: Array<{ day: string; dayIndex: number; count: number }>;
  logByMonth: Array<{ month: string; count: number }>;
};

function inPeriod(iso: string, start: Date, end: Date): boolean {
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t <= end.getTime();
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("de-DE", { month: "short", year: "2-digit" });
}

function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function formatDocumentBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"] as const;
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const digits = unitIndex === 0 ? 0 : value >= 100 ? 0 : 1;
  return `${value.toFixed(digits).replace(".", ",")} ${units[unitIndex]}`;
}

export function computeDocumentStatistics(
  input: DocumentStatisticsInput,
): DocumentStatisticsResult {
  const documentsInPeriod = input.documents.filter((row) =>
    inPeriod(row.created_at, input.periodStart, input.periodEnd),
  );
  const logInPeriod = input.logEntries.filter((row) =>
    inPeriod(row.created_at, input.periodStart, input.periodEnd),
  );

  const withTagCount = input.documents.filter((row) => row.tag_name != null).length;
  const withoutTagCount = input.documents.length - withTagCount;
  const bytesAddedInPeriod = documentsInPeriod.reduce(
    (sum, row) => sum + row.size_bytes,
    0,
  );
  const avgFileSizeBytes =
    input.documents.length > 0
      ? Math.round(
          input.documents.reduce((sum, row) => sum + row.size_bytes, 0) /
            input.documents.length,
        )
      : null;

  const tagCounts = new Map<string, number>();
  for (const row of input.documents) {
    const name = row.tag_name ?? "Ohne Tag";
    tagCounts.set(name, (tagCounts.get(name) ?? 0) + 1);
  }
  const byTag = [...tagCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  const topTag = byTag[0]?.name === "Ohne Tag" ? byTag[1]?.name ?? null : byTag[0]?.name ?? null;

  const actionCounts = new Map<DocumentLogAction, number>();
  for (const row of logInPeriod) {
    actionCounts.set(row.action, (actionCounts.get(row.action) ?? 0) + 1);
  }
  const byAction = [...actionCounts.entries()]
    .map(([action, count]) => ({
      action,
      label: logActionLabel(action),
      count,
      fill: ACTION_COLORS[action],
    }))
    .sort((a, b) => b.count - a.count);
  const topAction = byAction[0]?.label ?? null;
  const uploadsInPeriod = actionCounts.get("uploaded") ?? 0;

  const monthCounts = new Map<string, number>();
  for (const row of documentsInPeriod) {
    const key = monthKey(row.created_at);
    monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
  }
  const byMonth = [...monthCounts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({
      month: formatMonthLabel(month),
      count,
    }));

  const logMonthCounts = new Map<string, number>();
  for (const row of logInPeriod) {
    const key = monthKey(row.created_at);
    logMonthCounts.set(key, (logMonthCounts.get(key) ?? 0) + 1);
  }
  const logByMonth = [...logMonthCounts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({
      month: formatMonthLabel(month),
      count,
    }));

  const weekdayCounts = new Map<number, number>();
  for (const row of documentsInPeriod) {
    const d = new Date(row.created_at).getDay();
    weekdayCounts.set(d, (weekdayCounts.get(d) ?? 0) + 1);
  }
  const byWeekday = WEEKDAY_ORDER.map((dayIndex) => ({
    dayIndex,
    day: WEEKDAY_SHORT[dayIndex],
    count: weekdayCounts.get(dayIndex) ?? 0,
  }));

  return {
    totalDocuments: input.documents.length,
    documentsInPeriod: documentsInPeriod.length,
    documentsBytes: input.documentsBytes,
    bytesAddedInPeriod,
    withTagCount,
    withoutTagCount,
    logActionsInPeriod: logInPeriod.length,
    uploadsInPeriod,
    topTag,
    topAction,
    avgFileSizeBytes,
    byTag,
    byAction,
    byMonth,
    byWeekday,
    logByMonth,
  };
}
