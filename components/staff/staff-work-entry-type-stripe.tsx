import { cn } from "@/lib/utils";
import {
  STAFF_WORK_ENTRY_COLORS,
  type StaffWorkEntryType,
} from "@/lib/types/staff";

type StaffWorkEntryTypeStripeProps = {
  type?: StaffWorkEntryType;
  /** Überschreibt die Typ-Farbe (z. B. „Eingeloggt“ in der Monatszusammenfassung). */
  color?: string;
  className?: string;
};

/** Vertikaler Farbbalken für Arbeitszeit-Typen (grün / blau / rot …). */
export function StaffWorkEntryTypeStripe({
  type,
  color,
  className,
}: StaffWorkEntryTypeStripeProps) {
  const backgroundColor =
    color ?? (type ? STAFF_WORK_ENTRY_COLORS[type] : undefined);
  if (!backgroundColor) return null;

  return (
    <span
      className={cn("w-1 shrink-0 rounded-full", className)}
      style={{ backgroundColor }}
      aria-hidden
    />
  );
}
