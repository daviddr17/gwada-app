"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MENU_TAXONOMY_COLOR_INPUT_CLASSNAME } from "@/lib/constants/menu-color-picker";
import {
  isRestaurantPositionHexColor,
  normalizeRestaurantPositionColor,
} from "@/lib/restaurant/restaurant-position-colors";

/** Feld-Labels in Positions-Bottom-Sheets (wie Tischplan/Bereich-Drawer). */
export const restaurantPositionDrawerLabelClassName =
  "text-xs text-muted-foreground";

type RestaurantPositionColorFieldProps = {
  idPrefix: string;
  color: string;
  onColorChange: (color: string) => void;
  fallbackSeed?: string;
};

export function RestaurantPositionColorField({
  idPrefix,
  color,
  onColorChange,
  fallbackSeed,
}: RestaurantPositionColorFieldProps) {
  const displayColor = normalizeRestaurantPositionColor(color, fallbackSeed);

  return (
    <div className="space-y-2">
      <Label
        htmlFor={`${idPrefix}-color`}
        className={restaurantPositionDrawerLabelClassName}
      >
        Farbe
      </Label>
      <div className="flex items-center gap-3">
        <input
          id={`${idPrefix}-color`}
          type="color"
          value={displayColor}
          onChange={(e) => onColorChange(e.target.value)}
          className={MENU_TAXONOMY_COLOR_INPUT_CLASSNAME}
          aria-label="Farbe wählen"
        />
        <Input
          value={color}
          onChange={(e) => onColorChange(e.target.value)}
          placeholder="#64748b"
          className="h-12 flex-1 rounded-xl font-mono text-sm"
          spellCheck={false}
          maxLength={7}
          aria-label="Farbe als Hex"
        />
      </div>
    </div>
  );
}

export function resolvePositionColorInput(
  color: string,
  fallbackSeed: string,
): string {
  return isRestaurantPositionHexColor(color)
    ? color
    : normalizeRestaurantPositionColor(null, fallbackSeed);
}
