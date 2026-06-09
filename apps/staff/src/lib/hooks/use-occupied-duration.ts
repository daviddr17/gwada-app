import { useEffect, useState } from "react";

export function formatOccupiedDuration(
  openedAtIso: string,
  nowMs: number,
): string {
  const openedMs = new Date(openedAtIso).getTime();
  if (!Number.isFinite(openedMs)) return "—";

  const diffMs = Math.max(0, nowMs - openedMs);
  const totalMinutes = Math.floor(diffMs / 60_000);

  if (totalMinutes < 1) return "< 1 Min.";

  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    const dayPart = days === 1 ? "1 Tag" : `${days} Tage`;
    if (hours === 0) return dayPart;
    return `${dayPart} ${hours} Std.`;
  }

  if (hours === 0) return `${minutes} Min.`;
  if (minutes === 0) return `${hours} Std.`;
  return `${hours} Std. ${minutes} Min.`;
}

/** Live duration label for an open table session (updates every 30s). */
export function useOccupiedDuration(openedAtIso: string | undefined): string {
  const [label, setLabel] = useState("—");

  useEffect(() => {
    if (!openedAtIso) {
      setLabel("—");
      return;
    }

    const tick = () => {
      setLabel(formatOccupiedDuration(openedAtIso, Date.now()));
    };

    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [openedAtIso]);

  return label;
}

/** Compact time for table cards (today: only clock time). */
export function formatOpenedSinceShort(iso: string): string {
  const opened = new Date(iso);
  if (!Number.isFinite(opened.getTime())) return "—";

  const now = new Date();
  if (opened.toDateString() === now.toDateString()) {
    return opened.toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return opened.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
