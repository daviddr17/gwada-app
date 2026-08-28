import type { LaborComplianceViolation, LaborViolationCode } from "./de-arbzg-rules.ts";

const META: Record<
  LaborViolationCode,
  { title: string; legalRef: string; fixable: boolean }
> = {
  missing_break: {
    title: "Mindestpause fehlt",
    legalRef: "§ 4 ArbZG",
    fixable: true,
  },
  break_too_short: {
    title: "Pause zu kurz",
    legalRef: "§ 4 ArbZG",
    fixable: true,
  },
  continuous_work_exceeded: {
    title: "Zu lange am Stück gearbeitet",
    legalRef: "§ 4 ArbZG",
    fixable: true,
  },
  daily_hours_exceeded: {
    title: "Tageshöchstarbeitszeit überschritten",
    legalRef: "§ 3 ArbZG",
    fixable: false,
  },
  daily_average_exceeded: {
    title: "6-Monats-Durchschnitt überschritten",
    legalRef: "§ 3 ArbZG",
    fixable: false,
  },
  weekly_hours_exceeded: {
    title: "Wochenarbeitszeit überschritten",
    legalRef: "§ 3 ArbZG",
    fixable: false,
  },
  rest_period_short: {
    title: "Ruhezeit zu kurz",
    legalRef: "§ 5 ArbZG",
    fixable: false,
  },
  rest_compensation_missing: {
    title: "Ausgleichs-Ruhezeit fehlt",
    legalRef: "§ 5 Abs. 2 ArbZG (Gastro)",
    fixable: false,
  },
};

export function buildLaborViolation(params: {
  code: LaborViolationCode;
  staffId: string;
  dayYmd: string;
  message: string;
  hint: string;
  severity?: "error" | "warning";
  workStartIso?: string;
  workEndIso?: string;
  requiredBreakMinutes?: number;
  actualBreakMinutes?: number;
  netWorkMinutes?: number;
  weekLabel?: string;
}): LaborComplianceViolation {
  const meta = META[params.code];
  return {
    code: params.code,
    severity: params.severity ?? "error",
    title: meta.title,
    legalRef: meta.legalRef,
    fixable: meta.fixable,
    staffId: params.staffId,
    dayYmd: params.dayYmd,
    message: params.message,
    hint: params.hint,
    workStartIso: params.workStartIso,
    workEndIso: params.workEndIso,
    requiredBreakMinutes: params.requiredBreakMinutes,
    actualBreakMinutes: params.actualBreakMinutes,
    netWorkMinutes: params.netWorkMinutes,
    weekLabel: params.weekLabel,
  };
}

export function formatMinutesDe(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h <= 0) return `${m} min`;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}
