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
        "space-y-3 rounded-2xl border border-border/50 bg-card p-3 shadow-card",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 text-center">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Von</p>
          <p className="text-2xl font-semibold tabular-nums">
            {minutesToHHmm(slotMinutes[fromIdx] ?? 0)}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">–</p>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Bis</p>
          <p className="text-2xl font-semibold tabular-nums">
            {minutesToHHmm(slotMinutes[toIdx] ?? 0)}
          </p>
        </div>
      </div>

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

      <div className="flex justify-between text-[11px] tabular-nums text-muted-foreground">
        <span>{minutesToHHmm(slotMinutes[0] ?? 0)}</span>
        {hint ? <span className="text-center">{hint}</span> : null}
        <span>{minutesToHHmm(slotMinutes[max] ?? 0)}</span>
      </div>
    </div>
  );
}

export { displaySliderClassName };
