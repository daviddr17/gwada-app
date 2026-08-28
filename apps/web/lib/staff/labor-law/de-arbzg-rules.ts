/** ArbZG-Baseline (Deutschland) — Gastronomie ohne Tarifvertrag. */

export const DE_ARBZG = {
  maxDailyWorkMinutes: 10 * 60,
  maxWeeklyWorkMinutes: 48 * 60,
  maxContinuousWorkMinutes: 6 * 60,
  minRestMinutesDefault: 11 * 60,
  /** Gastronomie §5 Abs. 2 — verkürzte Ruhezeit */
  minRestMinutesGastroShort: 10 * 60,
  restCompensationMinutes: 12 * 60,
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
  | "weekly_hours_exceeded"
  | "rest_period_short";

export type LaborComplianceViolation = {
  code: LaborViolationCode;
  message: string;
  staffId: string;
  dayYmd: string;
  /** ISO range for fix UI */
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
  /** Nur Modus extend_end: neues Ausstempeln */
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

function requiredBreakMinutes(netWorkMinutes: number): number {
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
  nowMs?: number;
}): DayWorkAnalysis | null {
  const nowMs = params.nowMs ?? Date.now();
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

export function evaluateDeArbzgDay(
  analysis: DayWorkAnalysis,
): LaborComplianceViolation[] {
  const violations: LaborComplianceViolation[] = [];
  const required = requiredBreakMinutes(analysis.netWorkMinutes);
  const firstStart = analysis.workPeriods[0]!.startMs;
  const lastEnd = analysis.workPeriods.at(-1)!.endMs;

  if (
    required > 0 &&
    analysis.totalBreakMinutes + 0.001 < required
  ) {
    violations.push({
      code: "missing_break",
      staffId: analysis.staffId,
      dayYmd: analysis.dayYmd,
      message: `Mindestpause fehlt oder zu kurz: ${Math.round(analysis.totalBreakMinutes)} von ${required} Min. (netto ${formatMin(analysis.netWorkMinutes)} Arbeit).`,
      workStartIso: new Date(firstStart).toISOString(),
      workEndIso: new Date(lastEnd).toISOString(),
      requiredBreakMinutes: required,
      actualBreakMinutes: Math.round(analysis.totalBreakMinutes),
      netWorkMinutes: Math.round(analysis.netWorkMinutes),
    });
  }

  if (
    analysis.longestContinuousWorkMinutes >
    DE_ARBZG.maxContinuousWorkMinutes + 0.001
  ) {
    violations.push({
      code: "continuous_work_exceeded",
      staffId: analysis.staffId,
      dayYmd: analysis.dayYmd,
      message: `Mehr als ${DE_ARBZG.maxContinuousWorkMinutes / 60} h am Stück ohne Pause (${formatMin(analysis.longestContinuousWorkMinutes)}).`,
      workStartIso: new Date(firstStart).toISOString(),
      workEndIso: new Date(lastEnd).toISOString(),
      netWorkMinutes: Math.round(analysis.netWorkMinutes),
    });
  }

  if (analysis.netWorkMinutes > DE_ARBZG.maxDailyWorkMinutes + 0.001) {
    violations.push({
      code: "daily_hours_exceeded",
      staffId: analysis.staffId,
      dayYmd: analysis.dayYmd,
      message: `Tageshöchstarbeitszeit überschritten: ${formatMin(analysis.netWorkMinutes)} (max. ${DE_ARBZG.maxDailyWorkMinutes / 60} h).`,
      workStartIso: new Date(firstStart).toISOString(),
      workEndIso: new Date(lastEnd).toISOString(),
      netWorkMinutes: Math.round(analysis.netWorkMinutes),
    });
  }

  return violations;
}

export function evaluateDeArbzgRestPeriod(params: {
  staffId: string;
  previousDayEndIso: string;
  nextDayStartIso: string;
  dayYmd: string;
  gastroShortRestAllowed?: boolean;
}): LaborComplianceViolation | null {
  const restMin =
    (parseMs(params.nextDayStartIso) - parseMs(params.previousDayEndIso)) /
    60_000;
  const minRequired = params.gastroShortRestAllowed
    ? DE_ARBZG.minRestMinutesGastroShort
    : DE_ARBZG.minRestMinutesDefault;

  if (restMin + 0.001 >= minRequired) return null;

  return {
    code: "rest_period_short",
    staffId: params.staffId,
    dayYmd: params.dayYmd,
    message: `Ruhezeit zu kurz: ${Math.round(restMin)} min (min. ${minRequired / 60} h${params.gastroShortRestAllowed ? ", Gastro-Ausnahme" : ""}).`,
    workStartIso: params.previousDayEndIso,
    workEndIso: params.nextDayStartIso,
  };
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

function formatMin(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h <= 0) return `${m} min`;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}
