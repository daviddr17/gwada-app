"use client";

import { useMemo, useState, type ReactNode } from "react";
import { LayoutGrid, Refrigerator } from "lucide-react";
import { CategoriesManageDrawer } from "@/components/menu/categories-manage-drawer";
import { MenuTaxonomyDrawer } from "@/components/menu/menu-taxonomy-drawer";
import { ChecklistDeviceFormDrawer } from "@/components/checklisten/checklist-device-form-drawer";
import { Button } from "@/components/ui/button";
import { moduleManageChipButtonClassName } from "@/lib/ui/module-manage-chip";
import { profileDockActiveBgClassName } from "@/lib/public-profile/profile-dock-styles";
import type { useChecklistAreasStorage } from "@/lib/hooks/use-checklist-areas-storage";
import type { useChecklistDevicesStorage } from "@/lib/hooks/use-checklist-devices-storage";
import type { RestaurantChecklistDeviceRow } from "@/lib/types/checklist-areas-devices";
import { cn } from "@/lib/utils";

type AreasStorage = ReturnType<typeof useChecklistAreasStorage>;
type DevicesStorage = ReturnType<typeof useChecklistDevicesStorage>;

type ChecklistTaxonomyPanelProps = {
  areasStorage: AreasStorage;
  devicesStorage: DevicesStorage;
  filterAreaId: string | null;
  onFilterAreaIdChange: (id: string | null) => void;
  filterDeviceId: string | null;
  onFilterDeviceIdChange: (id: string | null) => void;
  canManage: boolean;
  /** KPI-Zeile: Chips und Verwaltung inline statt eigener Blöcke. */
  layout?: "stacked" | "inline";
};

function FilterPill({
  label,
  active,
  onClick,
  leading,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  leading?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex max-w-[12rem] shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? cn(
              "border-border/60 text-foreground shadow-none dark:shadow-sm",
              profileDockActiveBgClassName,
            )
          : "border-border/60 bg-card text-muted-foreground shadow-none hover:bg-muted/80 hover:text-foreground dark:shadow-xs",
      )}
    >
      {leading}
      <span className="truncate">{label}</span>
    </button>
  );
}

export function ChecklistTaxonomyPanel({
  areasStorage,
  devicesStorage,
  filterAreaId,
  onFilterAreaIdChange,
  filterDeviceId,
  onFilterDeviceIdChange,
  canManage,
  layout = "stacked",
}: ChecklistTaxonomyPanelProps) {
  const [manageAreasOpen, setManageAreasOpen] = useState(false);
  const [areaSheet, setAreaSheet] = useState<{
    mode: "create" | "edit";
    initial?: { id: string; name: string; active: boolean; backgroundColor: string };
  } | null>(null);

  const [manageDevicesOpen, setManageDevicesOpen] = useState(false);
  const [deviceSheet, setDeviceSheet] = useState<RestaurantChecklistDeviceRow | null | "create">(
    null,
  );

  const activeAreas = useMemo(
    () => areasStorage.items.filter((a) => a.active),
    [areasStorage.items],
  );

  const activeDevices = useMemo(
    () => devicesStorage.items.filter((d) => d.is_active),
    [devicesStorage.items],
  );

  const areaManageItems = areasStorage.items.map((a) => ({
    id: a.id,
    name: a.name,
    active: a.active,
  }));

  const deviceManageItems = devicesStorage.items.map((d) => ({
    id: d.id,
    name: d.name,
    active: d.is_active,
  }));

  const showAreaFilters = activeAreas.length > 0;
  const showDeviceFilters = activeDevices.length > 0;

  const manageButtons = canManage ? (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={moduleManageChipButtonClassName}
        onClick={() => setManageAreasOpen(true)}
      >
        <LayoutGrid className="size-4" />
        Bereiche
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={moduleManageChipButtonClassName}
        onClick={() => setManageDevicesOpen(true)}
      >
        <Refrigerator className="size-4" />
        Geräte
      </Button>
    </>
  ) : null;

  const areaFilterPills = showAreaFilters ? (
    <>
      <FilterPill
        label="Alle Bereiche"
        active={filterAreaId == null}
        onClick={() => onFilterAreaIdChange(null)}
      />
      {activeAreas.map((a) => (
        <FilterPill
          key={a.id}
          label={a.name}
          active={filterAreaId === a.id}
          leading={
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: a.backgroundColor }}
              aria-hidden
            />
          }
          onClick={() =>
            onFilterAreaIdChange(filterAreaId === a.id ? null : a.id)
          }
        />
      ))}
    </>
  ) : null;

  const deviceFilterPills = showDeviceFilters ? (
    <>
      <FilterPill
        label="Alle Geräte"
        active={filterDeviceId == null}
        onClick={() => onFilterDeviceIdChange(null)}
      />
      {activeDevices.map((d) => (
        <FilterPill
          key={d.id}
          label={d.name}
          active={filterDeviceId === d.id}
          leading={
            <Refrigerator
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden
            />
          }
          onClick={() =>
            onFilterDeviceIdChange(filterDeviceId === d.id ? null : d.id)
          }
        />
      ))}
    </>
  ) : null;

  const drawers = canManage ? (
    <>
      <CategoriesManageDrawer
            open={manageAreasOpen}
            onOpenChange={setManageAreasOpen}
            categories={areaManageItems}
            onReorder={(next) =>
              void areasStorage.reorder(
                next.map((n) => {
                  const full = areasStorage.getById(n.id)!;
                  return { ...full, name: n.name, active: n.active !== false };
                }),
              )
            }
            onEdit={(row) => {
              const full = areasStorage.getById(row.id);
              if (!full) return;
              setAreaSheet({
                mode: "edit",
                initial: {
                  id: full.id,
                  name: full.name,
                  active: full.active,
                  backgroundColor: full.backgroundColor,
                },
              });
            }}
            onNew={() => setAreaSheet({ mode: "create" })}
            rowLeading={(row) => {
              const full = areasStorage.getById(row.id);
              if (!full) return null;
              return (
                <span
                  className="mr-2 size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: full.backgroundColor }}
                />
              );
            }}
            copy={{
              title: "Bereiche",
              description:
                "Bereiche gruppieren Geräte und Aufgaben — z. B. Küche, Lager, Bar.",
              newButton: "Neuer Bereich",
            }}
          />

          <MenuTaxonomyDrawer
            open={areaSheet != null}
            onOpenChange={(o) => {
              if (!o) setAreaSheet(null);
            }}
            mode={areaSheet?.mode ?? "create"}
            initial={
              areaSheet?.initial
                ? {
                    id: areaSheet.initial.id,
                    name: areaSheet.initial.name,
                    active: areaSheet.initial.active,
                    backgroundColor: areaSheet.initial.backgroundColor,
                  }
                : null
            }
            variant="checklistAreas"
            onSave={(payload) => {
              if ("id" in payload) {
                void areasStorage.update(payload.id, {
                  name: payload.name,
                  active: payload.active,
                  backgroundColor: payload.backgroundColor,
                });
              } else {
                void areasStorage.add(
                  payload.name,
                  payload.active ?? true,
                  payload.backgroundColor,
                );
              }
              setAreaSheet(null);
            }}
            onDelete={
              areaSheet?.mode === "edit" && areaSheet.initial
                ? async (id) => {
                    await areasStorage.remove(id);
                    setAreaSheet(null);
                  }
                : undefined
            }
          />

          <CategoriesManageDrawer
            open={manageDevicesOpen}
            onOpenChange={setManageDevicesOpen}
            categories={deviceManageItems}
            onReorder={(next) =>
              void devicesStorage.reorder(
                next.map((n) => {
                  const full = devicesStorage.getById(n.id)!;
                  return { ...full, name: n.name, is_active: n.active !== false };
                }),
              )
            }
            onEdit={(row) => {
              const full = devicesStorage.getById(row.id);
              if (full) setDeviceSheet(full);
            }}
            onNew={() => setDeviceSheet("create")}
            copy={{
              title: "Geräte",
              description:
                "Kühlschränke, Truhen und Thermometer — optional mit Soll-Temperatur.",
              newButton: "Neues Gerät",
            }}
          />

          <ChecklistDeviceFormDrawer
            open={deviceSheet != null}
            onOpenChange={(o) => {
              if (!o) setDeviceSheet(null);
            }}
            device={deviceSheet === "create" ? null : deviceSheet}
            areas={areasStorage.items}
            onSave={async (input, deviceId) => {
              const result = await devicesStorage.upsert(input, deviceId);
              return result != null;
            }}
            onDelete={
              deviceSheet && deviceSheet !== "create"
                ? async (id) => devicesStorage.remove(id)
                : undefined
            }
      />
    </>
  ) : null;

  if (layout === "inline") {
    if (!canManage) return drawers;

    return (
      <>
        <div className="flex flex-wrap items-center gap-2">{manageButtons}</div>
        {drawers}
      </>
    );
  }

  return (
    <div className="mb-4 space-y-3">
      {manageButtons ? (
        <div className="flex flex-wrap gap-2">{manageButtons}</div>
      ) : null}

      {showAreaFilters ? (
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {areaFilterPills}
        </div>
      ) : null}

      {showDeviceFilters ? (
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {deviceFilterPills}
        </div>
      ) : null}

      {drawers}
    </div>
  );
}
