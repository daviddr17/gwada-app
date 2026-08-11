import type { RestaurantStaffRow } from "@/lib/types/staff";
import { staffDisplayName } from "@/lib/types/staff";

export type StaffBirthdayToday = {
  staffId: string;
  name: string;
  birthDate: string;
  age: number | null;
};

function monthDayFromYmd(ymd: string): { month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isFinite(month) || !Number.isFinite(day)) return null;
  return { month, day };
}

function ageYearsOnBirthday(birthYmd: string, todayYmd: string): number | null {
  const birth = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthYmd.trim());
  const today = /^(\d{4})-(\d{2})-(\d{2})$/.exec(todayYmd.trim());
  if (!birth || !today) return null;
  const age = Number(today[1]) - Number(birth[1]);
  return Number.isFinite(age) && age >= 0 && age < 130 ? age : null;
}

/** Aktive Mitarbeiter mit Geburtstag am Restaurant-Kalendertag (MM-DD). */
export function listStaffBirthdaysToday(
  staff: readonly RestaurantStaffRow[],
  todayYmd: string,
): StaffBirthdayToday[] {
  const todayMd = monthDayFromYmd(todayYmd);
  if (!todayMd) return [];

  const out: StaffBirthdayToday[] = [];
  for (const row of staff) {
    if (!row.is_active) continue;
    const birth = row.birth_date?.trim();
    if (!birth) continue;
    const birthMd = monthDayFromYmd(birth);
    if (!birthMd) continue;
    if (birthMd.month !== todayMd.month || birthMd.day !== todayMd.day) continue;
    out.push({
      staffId: row.id,
      name: staffDisplayName(row),
      birthDate: birth,
      age: ageYearsOnBirthday(birth, todayYmd),
    });
  }

  out.sort((a, b) => a.name.localeCompare(b.name, "de"));
  return out;
}
