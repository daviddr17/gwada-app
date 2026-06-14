"use client";

import { cn } from "@/lib/utils";

function StatItem({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

export function ReservationsOverviewPeriodStats({
  reservationCount,
  guestCount,
  avgPartySize,
  daysWithReservations,
  dayCount,
  className,
}: {
  reservationCount: number;
  guestCount: number;
  avgPartySize: number;
  daysWithReservations: number;
  dayCount: number;
  className?: string;
}) {
  const avgLabel =
    reservationCount > 0
      ? avgPartySize.toLocaleString("de-DE", { maximumFractionDigits: 1 })
      : "—";

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-x-3 gap-y-3 rounded-2xl border border-border/50 bg-muted/15 p-3 text-sm sm:grid-cols-4",
        className,
      )}
      aria-label="Statistik für den angezeigten Zeitraum"
    >
      <StatItem label="Reservierungen" value={reservationCount} />
      <StatItem label="Personen" value={guestCount} />
      <StatItem label="Ø pro Reservierung" value={avgLabel} />
      <StatItem
        label="Tage mit Reservierungen"
        value={`${daysWithReservations} / ${dayCount}`}
      />
    </div>
  );
}
