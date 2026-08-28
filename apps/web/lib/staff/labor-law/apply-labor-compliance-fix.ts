import {
  analyzeStaffDayWork,
  suggestBreakFixForDay,
  type LaborComplianceViolation,
} from "@/lib/staff/labor-law/de-arbzg-rules";
import {
  fetchStaffWorkEntriesInRange,
  upsertStaffWorkEntry,
} from "@/lib/supabase/staff-db";

export async function applyLaborComplianceBulkFix(params: {
  restaurantId: string;
  violations: LaborComplianceViolation[];
  mode: "normal" | "extend_end";
}): Promise<{ fixedCount: number; skippedCount: number; error: string | null }> {
  let fixedCount = 0;
  let skippedCount = 0;

  const seen = new Set<string>();

  for (const violation of params.violations) {
    const key = `${violation.staffId}:${violation.dayYmd}:${violation.code}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (!violation.workStartIso || !violation.workEndIso) {
      skippedCount += 1;
      continue;
    }

    const rangeStart = new Date(violation.workStartIso);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(violation.workEndIso);
    rangeEnd.setHours(23, 59, 59, 999);

    const { data: entries, error: fetchErr } = await fetchStaffWorkEntriesInRange(
      params.restaurantId,
      violation.staffId,
      rangeStart.toISOString(),
      rangeEnd.toISOString(),
    );
    if (fetchErr) {
      return { fixedCount, skippedCount, error: fetchErr };
    }

    const workEntries = entries.filter((e) => e.entry_type === "work");
    const breakEntries = entries.filter((e) => e.entry_type === "break");
    const analysis = analyzeStaffDayWork({
      staffId: violation.staffId,
      dayYmd: violation.dayYmd,
      workEntries,
      breakEntries,
    });
    if (!analysis) {
      skippedCount += 1;
      continue;
    }

    const suggestion = suggestBreakFixForDay(analysis, params.mode);
    if (!suggestion) {
      skippedCount += 1;
      continue;
    }

    const primaryWork = workEntries.sort(
      (a, b) =>
        new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
    )[0];
    if (!primaryWork) {
      skippedCount += 1;
      continue;
    }

    if (
      params.mode === "extend_end" &&
      suggestion.extendedWorkEndIso &&
      !primaryWork.is_open
    ) {
      const updated = await upsertStaffWorkEntry(
        params.restaurantId,
        violation.staffId,
        {
          id: primaryWork.id,
          entry_type: "work",
          starts_at: primaryWork.starts_at,
          ends_at: suggestion.extendedWorkEndIso,
          note: primaryWork.note,
          is_open: false,
          shift_id: primaryWork.shift_id,
        },
      );
      if (!updated) {
        return {
          fixedCount,
          skippedCount,
          error: "Arbeitsblock konnte nicht verlängert werden.",
        };
      }
    }

    const inserted = await upsertStaffWorkEntry(
      params.restaurantId,
      violation.staffId,
      {
        entry_type: "break",
        starts_at: suggestion.breakStartIso,
        ends_at: suggestion.breakEndIso,
        note: "ArbZG-Korrektur",
        is_open: false,
        shift_id: primaryWork.shift_id,
      },
    );
    if (!inserted) {
      return {
        fixedCount,
        skippedCount,
        error: "Pause konnte nicht eingetragen werden.",
      };
    }
    fixedCount += 1;
  }

  return { fixedCount, skippedCount, error: null };
}

/** Einzelner Tag nach Abschluss eines Arbeitseintrags (Auto-Fix-Einstellung). */
export async function applyLaborComplianceAutoFixForStaffDay(params: {
  restaurantId: string;
  staffId: string;
  dayYmd: string;
  mode?: "normal" | "extend_end";
}): Promise<{ fixed: boolean; error: string | null }> {
  const mode = params.mode ?? "normal";
  const rangeStart = new Date(`${params.dayYmd}T00:00:00`);
  const rangeEnd = new Date(`${params.dayYmd}T23:59:59.999`);

  const { data: entries, error: fetchErr } = await fetchStaffWorkEntriesInRange(
    params.restaurantId,
    params.staffId,
    rangeStart.toISOString(),
    rangeEnd.toISOString(),
  );
  if (fetchErr) {
    return { fixed: false, error: fetchErr };
  }

  const workEntries = entries.filter((e) => e.entry_type === "work");
  const breakEntries = entries.filter((e) => e.entry_type === "break");
  const analysis = analyzeStaffDayWork({
    staffId: params.staffId,
    dayYmd: params.dayYmd,
    workEntries,
    breakEntries,
  });
  if (!analysis) {
    return { fixed: false, error: null };
  }

  const suggestion = suggestBreakFixForDay(analysis, mode);
  if (!suggestion) {
    return { fixed: false, error: null };
  }

  const primaryWork = workEntries.sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
  )[0];
  if (!primaryWork) {
    return { fixed: false, error: null };
  }

  if (
    mode === "extend_end" &&
    suggestion.extendedWorkEndIso &&
    !primaryWork.is_open
  ) {
    const updated = await upsertStaffWorkEntry(
      params.restaurantId,
      params.staffId,
      {
        id: primaryWork.id,
        entry_type: "work",
        starts_at: primaryWork.starts_at,
        ends_at: suggestion.extendedWorkEndIso,
        note: primaryWork.note,
        is_open: false,
        shift_id: primaryWork.shift_id,
      },
    );
    if (!updated) {
      return { fixed: false, error: "Arbeitsblock konnte nicht verlängert werden." };
    }
  }

  const inserted = await upsertStaffWorkEntry(
    params.restaurantId,
    params.staffId,
    {
      entry_type: "break",
      starts_at: suggestion.breakStartIso,
      ends_at: suggestion.breakEndIso,
      note: "ArbZG-Korrektur (Auto)",
      is_open: false,
      shift_id: primaryWork.shift_id,
    },
  );
  if (!inserted) {
    return { fixed: false, error: "Pause konnte nicht eingetragen werden." };
  }

  return { fixed: true, error: null };
}
