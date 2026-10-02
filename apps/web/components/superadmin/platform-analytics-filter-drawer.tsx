"use client";

import { toast } from "sonner";
import { SearchableSelect } from "@/components/ui/combobox";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { DrawerFilterFooter } from "@/components/ui/drawer-filter-footer";
import {
  DrawerFilterField,
  DrawerFilterHeader,
  DrawerFilterZone,
} from "@/components/ui/drawer-filter-sheet";
import { staffDrawerFieldClassName } from "@/components/staff/staff-form-field-styles";
import type { AnalyticsRange } from "@/lib/analytics/analytics-range";
import { ANALYTICS_RANGE_OPTIONS } from "@/lib/analytics/analytics-labels";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerScrollAreaClassName } from "@/lib/ui/drawer-form-section";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";

const selectClassName = appSelectTriggerAccentCn(staffDrawerFieldClassName);

function AnalyticsFilterSheet({
  open,
  onOpenChange,
  onReset,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReset: () => void;
  children: React.ReactNode;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
      <DrawerContent className={drawerContentClassName("filter")}>
        <DrawerFilterHeader title="Filter" />
        <div className={drawerScrollAreaClassName(6)}>
          <DrawerFilterZone showLabel={false}>{children}</DrawerFilterZone>
        </div>
        <DrawerFilterFooter
          onReset={() => {
            onReset();
            toast.success("Filter zurückgesetzt");
          }}
          onDone={() => onOpenChange(false)}
        />
      </DrawerContent>
    </Drawer>
  );
}

export function WebsiteAnalyticsFilterDrawer({
  open,
  onOpenChange,
  range,
  onRangeChange,
  device,
  onDeviceChange,
  deviceOptions,
  browser,
  onBrowserChange,
  browserOptions,
  country,
  onCountryChange,
  countryOptions,
  surface,
  onSurfaceChange,
  surfaceOptions,
  onReset,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  range: AnalyticsRange;
  onRangeChange: (value: AnalyticsRange) => void;
  device: string;
  onDeviceChange: (value: string) => void;
  deviceOptions: { value: string; label: string }[];
  browser: string;
  onBrowserChange: (value: string) => void;
  browserOptions: { value: string; label: string }[];
  country: string;
  onCountryChange: (value: string) => void;
  countryOptions: { value: string; label: string }[];
  surface: string;
  onSurfaceChange: (value: string) => void;
  surfaceOptions: { value: string; label: string }[];
  onReset: () => void;
}) {
  return (
    <AnalyticsFilterSheet open={open} onOpenChange={onOpenChange} onReset={onReset}>
      <DrawerFilterField label="Zeitraum">
        <SearchableSelect
          options={ANALYTICS_RANGE_OPTIONS}
          value={range}
          onValueChange={(value) => {
            if (value === "today" || value === "7d" || value === "30d" || value === "90d") {
              onRangeChange(value);
            }
          }}
          aria-label="Zeitraum"
          className={selectClassName}
        />
      </DrawerFilterField>
      <DrawerFilterField label="Bereich">
        <SearchableSelect
          options={surfaceOptions}
          value={surface}
          onValueChange={onSurfaceChange}
          aria-label="Bereich"
          className={selectClassName}
        />
      </DrawerFilterField>
      <DrawerFilterField label="Gerät">
        <SearchableSelect
          options={deviceOptions}
          value={device}
          onValueChange={onDeviceChange}
          aria-label="Gerät"
          className={selectClassName}
        />
      </DrawerFilterField>
      <DrawerFilterField label="Browser">
        <SearchableSelect
          options={browserOptions}
          value={browser}
          onValueChange={onBrowserChange}
          aria-label="Browser"
          className={selectClassName}
        />
      </DrawerFilterField>
      <DrawerFilterField label="Land">
        <SearchableSelect
          options={countryOptions}
          value={country}
          onValueChange={onCountryChange}
          placeholder="Alle Länder"
          searchPlaceholder="Land suchen…"
          aria-label="Land"
          className={selectClassName}
        />
      </DrawerFilterField>
    </AnalyticsFilterSheet>
  );
}

export function ProductUsageFilterDrawer({
  open,
  onOpenChange,
  range,
  onRangeChange,
  moduleId,
  onModuleChange,
  moduleOptions,
  restaurantId,
  onRestaurantChange,
  restaurantOptions,
  onReset,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  range: AnalyticsRange;
  onRangeChange: (value: AnalyticsRange) => void;
  moduleId: string;
  onModuleChange: (value: string) => void;
  moduleOptions: { value: string; label: string }[];
  restaurantId: string;
  onRestaurantChange: (value: string) => void;
  restaurantOptions: { value: string; label: string }[];
  onReset: () => void;
}) {
  return (
    <AnalyticsFilterSheet open={open} onOpenChange={onOpenChange} onReset={onReset}>
      <DrawerFilterField label="Zeitraum">
        <SearchableSelect
          options={ANALYTICS_RANGE_OPTIONS}
          value={range}
          onValueChange={(value) => {
            if (value === "today" || value === "7d" || value === "30d" || value === "90d") {
              onRangeChange(value);
            }
          }}
          aria-label="Zeitraum"
          className={selectClassName}
        />
      </DrawerFilterField>
      <DrawerFilterField label="Modul">
        <SearchableSelect
          options={moduleOptions}
          value={moduleId}
          onValueChange={onModuleChange}
          placeholder="Alle Module"
          searchPlaceholder="Modul suchen…"
          aria-label="Modul"
          className={selectClassName}
        />
      </DrawerFilterField>
      <DrawerFilterField label="Restaurant">
        <SearchableSelect
          options={restaurantOptions}
          value={restaurantId}
          onValueChange={onRestaurantChange}
          placeholder="Alle Restaurants"
          searchPlaceholder="Restaurant suchen…"
          aria-label="Restaurant"
          className={selectClassName}
        />
      </DrawerFilterField>
    </AnalyticsFilterSheet>
  );
}
