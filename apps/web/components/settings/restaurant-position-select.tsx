"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatRestaurantPositionLabel } from "@/lib/restaurant/format-restaurant-position-label";
import { normalizeRestaurantPositionColor } from "@/lib/restaurant/restaurant-position-colors";
import type { RestaurantPositionRow } from "@/lib/supabase/restaurant-positions-db";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { TagColorStripe } from "@/lib/ui/tag-color-stripe";
import { cn } from "@/lib/utils";

type RestaurantPositionSelectProps = {
  positions: RestaurantPositionRow[];
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  "aria-label"?: string;
  className?: string;
};

export function RestaurantPositionSelect({
  positions,
  value,
  onValueChange,
  disabled = false,
  placeholder = "Rolle wählen …",
  "aria-label": ariaLabel,
  className,
}: RestaurantPositionSelectProps) {
  const selected = positions.find((p) => p.id === value) ?? null;
  const selectedColor = selected
    ? normalizeRestaurantPositionColor(selected.color, selected.id)
    : undefined;

  return (
    <Select
      value={value || undefined}
      onValueChange={(value) => onValueChange(String(value))}
      disabled={disabled}
    >
      <SelectTrigger
        aria-label={ariaLabel}
        className={appSelectTriggerAccentCn(
          cn("h-9 max-w-[220px] rounded-xl", className),
        )}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <TagColorStripe color={selectedColor} className="mr-0 shrink-0" />
          <SelectValue placeholder={placeholder}>
            {selected ? formatRestaurantPositionLabel(selected) : null}
          </SelectValue>
        </span>
      </SelectTrigger>
      <SelectContent>
        {positions.map((p) => {
          const color = normalizeRestaurantPositionColor(p.color, p.id);
          return (
            <SelectItem key={p.id} value={p.id}>
              <TagColorStripe color={color} className="mr-0 shrink-0" />
              {formatRestaurantPositionLabel(p)}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
