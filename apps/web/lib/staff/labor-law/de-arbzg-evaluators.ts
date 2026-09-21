import {
  DE_ARBZG,
  type DayWorkAnalysis,
  type LaborComplianceViolation,
  mondayOfWeekYmd,
  requiredBreakMinutes,
  sixMonthWindowStartYmd,
  addDaysToYmd,
} from "./de-arbzg-rules";
import {
  buildLaborViolation,
  formatMinutesDe,
} from "./labor-violation-format";

function parseMs(iso: string): number {
  return new Date(iso).getTime();
}

export function evaluateDeArbzgDay(
  analysis: DayWorkAnalysis,
): LaborComplianceViolation[] {
  const violations: LaborComplianceViolation[] = [];
  const required = requiredBreakMinutes(analysis.netWorkMinutes);
  const firstStart = analysis.workPeriods[0]!.startMs;
  const lastEnd = analysis.workPeriods.at(-1)!.endMs;
  const netLabel = formatMinutesDe(analysis.netWorkMinutes);

  if (required > 0 && analysis.totalBreakMinutes + 0.001 < required) {
    const actual = Math.round(analysis.totalBreakMinutes);
    violations.push(
      buildLaborViolation({
        code: "missing_break",
        staffId: analysis.staffId,
        dayYmd: analysis.dayYmd,
        message: `An ${analysis.dayYmd} wurden ${netLabel} netto gearbeitet — es fehlen ${required - actual} Min. Pause (nur ${actual} von ${required} Min. erfasst).`,
        hint:
          required >= 45
            ? "Ab 9 h netto sind 45 Min. Ruhepause Pflicht (mind. 15-Min-Blöcke). Pausen eintragen oder „Pausen beheben“ nutzen."
            : "Ab 6 h netto sind 30 Min. Ruhepause Pflicht. Pausen eintragen oder „Pausen beheben“ nutzen.",
        workStartIso: new Date(firstStart).toISOString(),
        workEndIso: new Date(lastEnd).toISOString(),
        requiredBreakMinutes: required,
        actualBreakMinutes: actual,
        netWorkMinutes: Math.round(analysis.netWorkMinutes),
      }),
    );
  }

  if (
    analysis.longestContinuousWorkMinutes >
    DE_ARBZG.maxContinuousWorkMinutes + 0.001
  ) {
    violations.push(
      buildLaborViolation({
        code: "continuous_work_exceeded",
        staffId: analysis.staffId,
        dayYmd: analysis.dayYmd,
        message: `An ${analysis.dayYmd} wurde ${formatMinutesDe(analysis.longestContinuousWorkMinutes)} ohne Unterbrechung gearbeitet — erlaubt sind max. ${DE_ARBZG.maxContinuousWorkMinutes / 60} h am Stück.`,
        hint: "Pause während der Schicht eintragen oder Teildienst mit ausreichend Pause dazwischen planen.",
        workStartIso: new Date(firstStart).toISOString(),
        workEndIso: new Date(lastEnd).toISOString(),
        netWorkMinutes: Math.round(analysis.netWorkMinutes),
      }),
    );
  }

  if (analysis.netWorkMinutes > DE_ARBZG.maxDailyWorkMinutes + 0.001) {
    violations.push(
      buildLaborViolation({
        code: "daily_hours_exceeded",
        staffId: analysis.staffId,
        dayYmd: analysis.dayYmd,
        message: `An ${analysis.dayYmd}: ${netLabel} netto — die tägliche Höchstarbeitszeit von ${DE_ARBZG.maxDailyWorkMinutes / 60} h ist überschritten.`,
        hint: "Schicht kürzen oder auf weitere Tage verteilen; Ausgleich über 6 Monate gilt nur bis 10 h, nicht darüber.",
        workStartIso: new Date(firstStart).toISOString(),
        workEndIso: new Date(lastEnd).toISOString(),
        netWorkMinutes: Math.round(analysis.netWorkMinutes),
      }),
    );
  }

  return violations;
}

export function evaluateDeArbzgSixMonthAverage(params: {
  staffId: string;
  dayYmd: string;
  analyses: DayWorkAnalysis[];
}): LaborComplianceViolation | null {
  const windowStart = sixMonthWindowStartYmd(params.dayYmd);
  const inWindow = params.analyses.filter(
    (a) => a.staffId === params.staffId && a.dayYmd >= windowStart && a.dayYmd <= params.dayYmd,
  );
  if (inWindow.length === 0) return null;

  const totalNet = inWindow.reduce((s, a) => s + a.netWorkMinutes, 0);
  const avg = totalNet / inWindow.length;
  const today = inWindow.find((a) => a.dayYmd === params.dayYmd);
  if (!today || today.netWorkMinutes <= DE_ARBZG.targetDailyWorkMinutes + 0.001) {
    return null;
  }

  if (avg <= DE_ARBZG.targetDailyWorkMinutes + 0.001) return null;

  return buildLaborViolation({
    code: "daily_average_exceeded",
    staffId: params.staffId,
    dayYmd: params.dayYmd,
    severity: "warning",
    message: `6-Monats-Durchschnitt ab ${params.dayYmd}: ${formatMinutesDe(avg)} pro Arbeitstag (max. ${DE_ARBZG.targetDailyWorkMinutes / 60} h). An diesem Tag: ${formatMinutesDe(today.netWorkMinutes)} netto.`,
    hint: "Verlängerungen über 8 h nur mit Ausgleich an ruhigeren Tagen — Durchschnitt der letzten 6 Monate prüfen.",
    netWorkMinutes: Math.round(today.netWorkMinutes),
  });
}

export function evaluateDeArbzgWeekly(params: {
  staffId: string;
  weekMondayYmd: string;
  analyses: DayWorkAnalysis[];
}): LaborComplianceViolation | null {
  const weekEnd = addDaysToYmd(params.weekMondayYmd, 6);
  const weekLabel = `${params.weekMondayYmd} – ${weekEnd}`;
  const inWeek = params.analyses.filter(
    (a) =>
      a.staffId === params.staffId &&
      a.dayYmd >= params.weekMondayYmd &&
      a.dayYmd <= weekEnd,
  );
  if (inWeek.length === 0) return null;

  const totalNet = inWeek.reduce((s, a) => s + a.netWorkMinutes, 0);
  if (totalNet <= DE_ARBZG.maxWeeklyWorkMinutes + 0.001) return null;

  return buildLaborViolation({
    code: "weekly_hours_exceeded",
    staffId: params.staffId,
    dayYmd: weekEnd,
    weekLabel,
    message: `Kalenderwoche ${weekLabel}: ${formatMinutesDe(totalNet)} netto — max. ${DE_ARBZG.maxWeeklyWorkMinutes / 60} h/Woche überschritten.`,
    hint: "Stunden auf mehrere Mitarbeiter oder Wochen verteilen.",
    netWorkMinutes: Math.round(totalNet),
  });
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

  return buildLaborViolation({
    code: "rest_period_short",
    staffId: params.staffId,
    dayYmd: params.dayYmd,
    message: `Zwischen Schichtende und nächstem Dienst am ${params.dayYmd} nur ${formatMinutesDe(restMin)} Ruhe — mindestens ${formatMinutesDe(minRequired)} erforderlich.`,
    hint: params.gastroShortRestAllowed
      ? "Gastro: 10 h möglich, wenn innerhalb von 4 Wochen eine 12-h-Ruhezeit ausgeglichen wird."
      : "Nächsten Dienst später beginnen oder vorherige Schicht früher beenden.",
    workStartIso: params.previousDayEndIso,
    workEndIso: params.nextDayStartIso,
  });
}

type WorkBoundary = {
  staffId: string;
  endIso: string;
  startIso: string;
  restMinutes: number;
  nextDayYmd: string;
};

export function evaluateDeArbzgRestCompensation(
  boundaries: WorkBoundary[],
): LaborComplianceViolation[] {
  const violations: LaborComplianceViolation[] = [];
  const compensated = new Set<string>();

  for (const b of boundaries) {
    if (
      b.restMinutes < DE_ARBZG.minRestMinutesGastroShort ||
      b.restMinutes >= DE_ARBZG.minRestMinutesDefault
    ) {
      continue;
    }
    const windowEnd = addDaysToYmd(
      b.nextDayYmd,
      DE_ARBZG.restCompensationWindowDays,
    );
    let found = false;
    for (const other of boundaries) {
      if (other.staffId !== b.staffId) continue;
      if (other.nextDayYmd < b.nextDayYmd || other.nextDayYmd > windowEnd) continue;
      if (other.restMinutes + 0.001 >= DE_ARBZG.restCompensationMinutes) {
        compensated.add(`${b.staffId}:${b.nextDayYmd}`);
        found = true;
        break;
      }
    }
    if (!found && !compensated.has(`${b.staffId}:${b.nextDayYmd}`)) {
      violations.push(
        buildLaborViolation({
          code: "rest_compensation_missing",
          staffId: b.staffId,
          dayYmd: b.nextDayYmd,
          severity: "warning",
          message: `Ruhezeit am ${b.nextDayYmd} nur ${formatMinutesDe(b.restMinutes)} (Gastro-Ausnahme 10 h) — Ausgleich mit mind. ${DE_ARBZG.restCompensationMinutes / 60} h Ruhe innerhalb von ${DE_ARBZG.restCompensationWindowDays} Tagen fehlt.`,
          hint: "Später eine ununterbrochene Ruhezeit von mindestens 12 h gewähren und dokumentieren.",
          workStartIso: b.endIso,
          workEndIso: b.startIso,
        }),
      );
    }
  }

  return violations;
}

export { mondayOfWeekYmd };
