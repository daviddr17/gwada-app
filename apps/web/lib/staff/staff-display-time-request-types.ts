import type { StaffWorkEntryType } from "@/lib/types/staff";

/** Im Display-Nachtragen-Formular wählbare Arten. */
export const DISPLAY_TIME_REQUEST_ENTRY_TYPES = [
  "work",
  "break",
  "sick",
  "vacation",
] as const satisfies readonly StaffWorkEntryType[];

export type DisplayTimeRequestEntryType =
  (typeof DISPLAY_TIME_REQUEST_ENTRY_TYPES)[number];

export function isDisplayTimeRequestEntryType(
  value: string,
): value is DisplayTimeRequestEntryType {
  return (DISPLAY_TIME_REQUEST_ENTRY_TYPES as readonly string[]).includes(value);
}
