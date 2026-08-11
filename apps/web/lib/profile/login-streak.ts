export type LoginStreakDayCell = {
  day: string;
  active: boolean;
};

export type LoginStreakSummary = {
  currentStreak: number;
  longestStreak: number;
  totalDays: number;
  todayActive: boolean;
  /** Ältester → neuester Tag (Spaltenweise Wochen fürs Diagramm). */
  cells: LoginStreakDayCell[];
};

function addDaysYmd(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d! + delta));
  return dt.toISOString().slice(0, 10);
}

function dayDiff(a: string, b: string): number {
  const ta = Date.parse(`${a}T12:00:00Z`);
  const tb = Date.parse(`${b}T12:00:00Z`);
  return Math.round((tb - ta) / 86_400_000);
}

export function computeCurrentStreak(
  activeDays: ReadonlySet<string>,
  todayYmd: string,
): number {
  if (!activeDays.has(todayYmd) && !activeDays.has(addDaysYmd(todayYmd, -1))) {
    return 0;
  }
  let cursor = activeDays.has(todayYmd) ? todayYmd : addDaysYmd(todayYmd, -1);
  let streak = 0;
  while (activeDays.has(cursor)) {
    streak += 1;
    cursor = addDaysYmd(cursor, -1);
  }
  return streak;
}

export function computeLongestStreak(
  sortedDays: readonly string[],
): number {
  if (sortedDays.length === 0) return 0;
  let best = 1;
  let run = 1;
  for (let i = 1; i < sortedDays.length; i += 1) {
    if (dayDiff(sortedDays[i - 1]!, sortedDays[i]!) === 1) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 1;
    }
  }
  return best;
}

export function buildLoginStreakSummary(
  dayYmids: readonly string[],
  todayYmd: string,
  lookbackDays: number,
): LoginStreakSummary {
  const unique = [...new Set(dayYmids.map((d) => d.slice(0, 10)))].sort();
  const active = new Set(unique);
  const start = addDaysYmd(todayYmd, -(lookbackDays - 1));
  const cells: LoginStreakDayCell[] = [];
  for (let i = 0; i < lookbackDays; i += 1) {
    const day = addDaysYmd(start, i);
    cells.push({ day, active: active.has(day) });
  }

  return {
    currentStreak: computeCurrentStreak(active, todayYmd),
    longestStreak: computeLongestStreak(unique),
    totalDays: unique.length,
    todayActive: active.has(todayYmd),
    cells,
  };
}

/** Zellen in Wochen-Spalten (So–Sa oder Mo–So). Gwada: Montag zuerst. */
export function loginStreakCellsToWeekColumns(
  cells: readonly LoginStreakDayCell[],
): LoginStreakDayCell[][] {
  if (cells.length === 0) return [];

  const first = cells[0]!;
  const [y, m, d] = first.day.split("-").map(Number);
  const dow = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay(); // 0=So
  const mondayOffset = dow === 0 ? 6 : dow - 1;

  const padded: (LoginStreakDayCell | null)[] = [
    ...Array.from({ length: mondayOffset }, () => null),
    ...cells,
  ];
  while (padded.length % 7 !== 0) padded.push(null);

  const columns: LoginStreakDayCell[][] = [];
  for (let col = 0; col < padded.length / 7; col += 1) {
    const week: LoginStreakDayCell[] = [];
    for (let row = 0; row < 7; row += 1) {
      const cell = padded[col * 7 + row];
      if (cell) week.push(cell);
      else week.push({ day: "", active: false });
    }
    columns.push(week);
  }
  return columns;
}
