"use client";

import { useMemo } from "react";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/ui/combobox";
import { staffDrawerFieldClassName } from "@/components/staff/staff-form-field-styles";
import { formatRestaurantPositionLabel } from "@/lib/restaurant/format-restaurant-position-label";
import { normalizeRestaurantPositionColor } from "@/lib/restaurant/restaurant-position-colors";
import type { RestaurantPositionRow } from "@/lib/supabase/restaurant-positions-db";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { cn } from "@/lib/utils";

type StaffRestaurantRoleSelectProps = {
  positions: RestaurantPositionRow[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  "aria-label"?: string;
  className?: string;
};

export function StaffRestaurantRoleSelect({
  positions,
  value,
  onValueChange,
  placeholder = "Rolle wählen …",
  disabled = false,
  "aria-label": ariaLabel,
  className,
}: StaffRestaurantRoleSelectProps) {
  const options = useMemo((): SearchableSelectOption[] => {
    return positions.map((p) => ({
      value: p.id,
      label: formatRestaurantPositionLabel(p),
      leadingColor: normalizeRestaurantPositionColor(p.color, p.id),
    }));
  }, [positions]);

  return (
    <SearchableSelect
      options={options}
      value={value}
      onValueChange={onValueChange}
      placeholder={placeholder}
      searchPlaceholder="Rolle suchen …"
      disabled={disabled}
      aria-label={ariaLabel}
      className={appSelectTriggerAccentCn(cn(staffDrawerFieldClassName, className))}
    />
  );
}
