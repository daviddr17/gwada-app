/** ArbZG-Baseline (Deutschland) — Gastronomie ohne Tarifvertrag. */

export const DE_ARBZG = {
  maxDailyWorkMinutes: 10 * 60,
  targetDailyWorkMinutes: 8 * 60,
  maxWeeklyWorkMinutes: 48 * 60,
  maxContinuousWorkMinutes: 6 * 60,
  minRestMinutesDefault: 11 * 60,
  /** Gastronomie §5 Abs. 2 — verkürzte Ruhezeit */
  minRestMinutesGastroShort: 10 * 60,
  restCompensationMinutes: 12 * 60,
  restCompensationWindowDays: 28,
  rollingAverageMonths: 6,
  breakAfter6hMinutes: 30,
  breakAfter9hMinutes: 45,
  minBreakChunkMinutes: 15,
  /** Lücke zwischen Teildienst-Blöcken ≥ dieser Dauer zählt als Pause */
  implicitBreakGapMinutes: 15,
} as const;

export type LaborViolationCode =
  | "missing_break"
  | "break_too_short"
  | "continuous_work_exceeded"
  | "daily_hours_exceeded"
  | "daily_average_exceeded"
  | "weekly_hours_exceeded"
  | "rest_period_short"
  | "rest_compensation_missing";

export type LaborComplianceViolation = {
  code: LaborViolationCode;
  severity: "error" | "warning";
  title: string;
  message: string;
  hint: string;
  legalRef: string;
  fixable: boolean;
  staffId: string;
  dayYmd: string;
  weekLabel?: string;
  workStartIso?: string;
  workEndIso?: string;
  requiredBreakMinutes?: number;
  actualBreakMinutes?: number;
  netWorkMinutes?: number;
};

export type SuggestedBreakFix = {
  mode: "normal" | "extend_end";
  breakStartIso: string;
  breakEndIso: string;
  extendedWorkEndIso?: string;
};

export type WorkPeriod = {
  startMs: number;
  endMs: number;
  entryIds: string[];
};

export type DayWorkAnalysis = {
  staffId: string;
  dayYmd: string;
  workPeriods: WorkPeriod[];
  explicitBreakMinutes: number;
  implicitBreakMinutes: number;
  totalBreakMinutes: number;
  netWorkMinutes: number;
  longestContinuousWorkMinutes: number;
};

function parseMs(iso: string): number {
  return new Date(iso).getTime();
}

export function requiredBreakMinutes(netWorkMinutes: number): number {
  if (netWorkMinutes > 9 * 60) return DE_ARBZG.breakAfter9hMinutes;
  if (netWorkMinutes > 6 * 60) return DE_ARBZG.breakAfter6hMinutes;
  return 0;
}

/**
 * Teildienste: mehrere Work-Blöcke am Tag; Lücken ≥ 15 min zählen als implizite Pause.
 */
export function analyzeStaffDayWork(params: {
  staffId: string;
  dayYmd: string;
  workEntries: Array<{
    id: string;
    starts_at: string;
    ends_at: string;
    is_open?: boolean;
  }>;
  breakEntries: Array<{
    starts_at: string;
    ends_at: string;
    is_open?: boolean;
  }>;
}): DayWorkAnalysis | null {
  const closedWork = params.workEntries
    .filter((e) => !e.is_open && parseMs(e.ends_at) > parseMs(e.starts_at))
    .sort((a, b) => parseMs(a.starts_at) - parseMs(b.starts_at));

  if (closedWork.length === 0) return null;

  const workPeriods: WorkPeriod[] = closedWork.map((e) => ({
    startMs: parseMs(e.starts_at),
    endMs: parseMs(e.ends_at),
    entryIds: [e.id],
  }));

  let explicitBreakMinutes = 0;
  for (const b of params.breakEntries) {
    if (b.is_open) continue;
    const dur = (parseMs(b.ends_at) - parseMs(b.starts_at)) / 60_000;
    if (dur > 0) explicitBreakMinutes += dur;
  }

  let implicitBreakMinutes = 0;
  for (let i = 1; i < workPeriods.length; i++) {
    const gapMs = workPeriods[i]!.startMs - workPeriods[i - 1]!.endMs;
    const gapMin = gapMs / 60_000;
    if (gapMin >= DE_ARBZG.implicitBreakGapMinutes) {
      implicitBreakMinutes += gapMin;
    }
  }

  const totalWorkMs = workPeriods.reduce(
    (sum, p) => sum + (p.endMs - p.startMs),
    0,
  );
  const netWorkMinutes = Math.max(
    0,
    totalWorkMs / 60_000 - explicitBreakMinutes,
  );
  const totalBreakMinutes = explicitBreakMinutes + implicitBreakMinutes;

  let longestContinuousWorkMinutes = 0;
  for (const period of workPeriods) {
    let chunkStart = period.startMs;
    for (const b of params.breakEntries) {
      if (b.is_open) continue;
      const bs = parseMs(b.starts_at);
      const be = parseMs(b.ends_at);
      if (be <= period.startMs || bs >= period.endMs) continue;
      if (bs > chunkStart) {
        longestContinuousWorkMinutes = Math.max(
          longestContinuousWorkMinutes,
          (bs - chunkStart) / 60_000,
        );
      }
      chunkStart = Math.max(chunkStart, be);
    }
    longestContinuousWorkMinutes = Math.max(
      longestContinuousWorkMinutes,
      (period.endMs - chunkStart) / 60_000,
    );
  }

  if (workPeriods.length === 1 && explicitBreakMinutes === 0) {
    longestContinuousWorkMinutes = netWorkMinutes;
  }

  return {
    staffId: params.staffId,
    dayYmd: params.dayYmd,
    workPeriods,
    explicitBreakMinutes,
    implicitBreakMinutes,
    totalBreakMinutes,
    netWorkMinutes,
    longestContinuousWorkMinutes,
  };
}

export function mondayOfWeekYmd(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y!, m! - 1, d!);
  const dow = date.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  date.setDate(date.getDate() + diff);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function addDaysToYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y!, m! - 1, d!);
  date.setDate(date.getDate() + days);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function sixMonthWindowStartYmd(endYmd: string): string {
  const [y, m, d] = endYmd.split("-").map(Number);
  const date = new Date(y!, m! - 1, d!);
  date.setMonth(date.getMonth() - DE_ARBZG.rollingAverageMonths);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Pause ungefähr mittig im ersten Work-Block; Modus B verlängert Ende um Pausendauer. */
export function suggestBreakFixForDay(
  analysis: DayWorkAnalysis,
  mode: "normal" | "extend_end",
): SuggestedBreakFix | null {
  const required = requiredBreakMinutes(analysis.netWorkMinutes);
  if (required <= 0) return null;
  if (analysis.totalBreakMinutes + 0.001 >= required) return null;

  const period = analysis.workPeriods[0]!;
  const durationMs = period.endMs - period.startMs;
  const breakMs = required * 60_000;
  const breakStartMs = period.startMs + Math.floor((durationMs - breakMs) / 2);
  const breakEndMs = breakStartMs + breakMs;

  const fix: SuggestedBreakFix = {
    mode,
    breakStartIso: new Date(breakStartMs).toISOString(),
    breakEndIso: new Date(breakEndMs).toISOString(),
  };

  if (mode === "extend_end") {
    fix.extendedWorkEndIso = new Date(period.endMs + breakMs).toISOString();
  }

  return fix;
}
