"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { ReservationListRow } from "@/lib/supabase/reservations-db";

function guestInitialsDe(first: string, last: string): string {
  const a = first.trim().charAt(0);
  const b = last.trim().charAt(0);
  const A = a ? a.toLocaleUpperCase("de-DE") : "";
  const B = b ? b.toLocaleUpperCase("de-DE") : "";
  if (A && B) return A + B;
  if (B) return B;
  if (A) return A;
  return "—";
}

function approxTextWidthPx(text: string, fontSize: number): number {
  let w = 0;
  for (const ch of text) {
    if (ch === " ") w += fontSize * 0.3;
    else if (ch === "·") w += fontSize * 0.24;
    else if (ch === "#") w += fontSize * 0.55;
    else if (ch >= "0" && ch <= "9") w += fontSize * 0.52;
    else if (/[A-ZÄÖÜẞ]/.test(ch)) w += fontSize * 0.64;
    /** Kleinbuchstaben etwas breiter schätzen — weniger Abschneiden in schmalen Kacheln */
    else w += fontSize * 0.54;
  }
  return w;
}

/**
 * Eine Zeile, feste Schriftgröße (z. B. wie „frei“): wählt die informativste
 * Darstellung, die in `maxWidthPx` passt (`Name · #` → `Name` → … → MM).
 */
export function pickFloorTableCaption(
  first: string,
  last: string,
  reservationNumber: number,
  maxWidthPx: number,
  fontSizePx: number,
): string {
  const fn = first.trim();
  const ln = last.trim();
  const full = [fn, ln].filter(Boolean).join(" ") || "—";
  const nom = ln || fn || "—";
  const initial = guestInitialsDe(fn, ln);
  /** Zuerst längstmöglicher Text; voller Name ohne # vor kürzerem Namen mit #. */
  const tiers = [
    `${full} · #${reservationNumber}`,
    full,
    `${nom} · #${reservationNumber}`,
    nom,
    initial,
  ];
  const maxW = Math.max(8, maxWidthPx);
  const fs = Math.max(5, fontSizePx);
  const slack = 2;
  for (const t of tiers) {
    if (approxTextWidthPx(t, fs) <= maxW + slack) return t;
  }
  return initial;
}

export function fitGuestReservationBadge(params: {
  first: string;
  last: string;
  reservationNumber: number;
  maxWidthPx: number;
  maxHeightPx: number;
  maxFontPx?: number;
  minFontPx?: number;
}): { text: string; fontSize: number } {
  const maxFontPx = params.maxFontPx ?? 22;
  const minFontPx = params.minFontPx ?? 5;
  const maxW = Math.max(8, params.maxWidthPx);
  const maxH = Math.max(8, params.maxHeightPx);
  const lh = 1.15;

  const fn = params.first.trim();
  const ln = params.last.trim();
  const t0 = guestInitialsDe(fn, ln);
  const t1 = ln || fn || "—";
  const t2 = [fn, ln].filter(Boolean).join(" ") || "—";
  const t3 = `${t2} · #${params.reservationNumber}`;
  const tiers = [t3, t2, t1, t0];

  const fits = (text: string, fs: number) =>
    approxTextWidthPx(text, fs) <= maxW && fs * lh <= maxH;

  for (const text of tiers) {
    for (let fs = maxFontPx; fs >= minFontPx; fs--) {
      if (fits(text, fs)) {
        return { text, fontSize: fs };
      }
    }
  }
  let fs = minFontPx;
  while (fs > 4 && !fits(t0, fs)) fs--;
  return { text: t0, fontSize: Math.max(4, fs) };
}

type GuestReservationBadgeProps = {
  reservation: Pick<
    ReservationListRow,
    "guest_first_name" | "guest_last_name" | "reservation_number"
  >;
  className?: string;
  textClassName?: string;
  mode?: "measure" | "fixed";
  maxWidthPx?: number;
  maxHeightPx?: number;
  maxFontPx?: number;
  minFontPx?: number;
};

export function GuestReservationBadge({
  reservation,
  className,
  textClassName,
  mode = "measure",
  maxWidthPx = 120,
  maxHeightPx = 28,
  maxFontPx = 22,
  minFontPx = 5,
}: GuestReservationBadgeProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [measured, setMeasured] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    if (mode !== "measure") return;
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 4 && h > 4) setMeasured({ w, h });
    });
    ro.observe(el);
    const w0 = el.clientWidth;
    const h0 = el.clientHeight;
    if (w0 > 4 && h0 > 4) setMeasured({ w: w0, h: h0 });
    return () => ro.disconnect();
  }, [mode]);

  const box = useMemo(() => {
    if (mode === "fixed") {
      return {
        w: Math.max(8, maxWidthPx),
        h: Math.max(8, maxHeightPx),
      };
    }
    if (measured.w > 4 && measured.h > 4) return measured;
    return { w: 120, h: 26 };
  }, [mode, maxWidthPx, maxHeightPx, measured.w, measured.h]);

  const { text, fontSize } = useMemo(
    () =>
      fitGuestReservationBadge({
        first: reservation.guest_first_name,
        last: reservation.guest_last_name,
        reservationNumber: reservation.reservation_number,
        maxWidthPx: box.w,
        maxHeightPx: box.h,
        maxFontPx,
        minFontPx,
      }),
    [
      reservation.guest_first_name,
      reservation.guest_last_name,
      reservation.reservation_number,
      box.w,
      box.h,
      maxFontPx,
      minFontPx,
    ],
  );

  return (
    <span
      ref={ref}
      className={cn(
        "inline-block min-h-0 min-w-0 max-w-full whitespace-nowrap align-baseline",
        mode === "measure" && "w-full",
        className,
      )}
    >
      <span
        className={cn("inline-block max-w-full font-medium", textClassName)}
        style={{ fontSize, lineHeight: 1.12 }}
      >
        {text}
      </span>
    </span>
  );
}
