"use client";

import { Slider } from "@/components/ui/slider";
import { minutesToHHmm } from "@/lib/reservations/day-opening-slots";
import { cn } from "@/lib/utils";

const displaySliderClassName =
  "py-3 [&_[data-slot=slider-range]]:bg-accent [&_[data-slot=slider-thumb]]:size-5 [&_[data-slot=slider-thumb]]:border-accent [&_[data-slot=slider-thumb]]:ring-accent/30";

export function DisplayTimeRangeSlider({
  slotMinutes,
  value,
  onChange,
  className,
  hint,
}: {
  slotMinutes: number[];
  value: [number, number];
  onChange: (indices: [number, number]) => void;
  className?: string;
  hint?: string;
}) {
  if (slotMinutes.length <= 1) return null;

  const max = slotMinutes.length - 1;
  const fromIdx = Math.min(value[0], max);
  const toIdx = Math.min(Math.max(value[1], fromIdx), max);

  return (
    <div
      className={cn(
        "space-y-2 rounded-2xl border border-border/50 bg-card p-3 shadow-card",
        className,
      )}
    >
      <Slider
        min={0}
        max={max}
        step={1}
        value={[fromIdx, toIdx]}
        onValueChange={(values) => {
          const arr = Array.isArray(values) ? values : [values];
          let a = typeof arr[0] === "number" ? arr[0] : 0;
          let b = typeof arr[1] === "number" ? arr[1] : a;
          if (a > b) [a, b] = [b, a];
          onChange([
            Math.max(0, Math.min(max, a)),
            Math.max(0, Math.min(max, b)),
          ]);
        }}
        className={displaySliderClassName}
      />

      <div className="flex justify-between gap-2 text-[11px] tabular-nums text-muted-foreground">
        <span>{minutesToHHmm(slotMinutes[fromIdx] ?? 0)}</span>
        {hint ? <span className="min-w-0 flex-1 text-center">{hint}</span> : null}
        <span>{minutesToHHmm(slotMinutes[toIdx] ?? 0)}</span>
      </div>
    </div>
  );
}

export { displaySliderClassName };
