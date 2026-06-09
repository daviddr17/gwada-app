"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DrawerFormFooter } from "@/components/ui/drawer-form-footer";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  clampPct,
  FLOOR_PLAN_TABLE_MAX_H_PCT,
  FLOOR_PLAN_TABLE_MAX_W_PCT,
  FLOOR_PLAN_TABLE_MIN_H_PCT,
  FLOOR_PLAN_TABLE_MIN_W_PCT,
} from "@/components/reservations/floor-plan-geometry";
import {
  insertDiningTable,
  updateDiningTable,
  type DiningAreaRow,
  type DiningTableRow,
} from "@/lib/supabase/dining-floor-db";
import { MENU_TAXONOMY_COLOR_INPUT_CLASSNAME } from "@/lib/constants/menu-color-picker";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { cn } from "@/lib/utils";

const selectValueNoShrink =
  "[&_[data-slot=select-value]]:!min-w-0 [&_[data-slot=select-value]]:!shrink-0 [&_[data-slot=select-value]]:!grow-0 [&_[data-slot=select-value]]:overflow-visible [&_[data-slot=select-value]]:whitespace-nowrap";

const HEX = /^#[0-9A-Fa-f]{6}$/;

type DiningTableDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  areas: DiningAreaRow[];
  defaultAreaId: string | null;
  table: DiningTableRow | null;
  /** Neuer Tisch: Farbe, Größe, Kapazität & Startposition von diesem Tisch übernehmen */
  styleTemplate?: DiningTableRow | null;
  nextTableNumber: number;
  onSaved: () => void;
};

function defaultColorForArea(areas: DiningAreaRow[], areaId: string): string {
  const a = areas.find((x) => x.id === areaId);
  if (a && HEX.test(a.color_hex)) return a.color_hex;
  return "#94a3b8";
}

export function DiningTableDrawer({
  open,
  onOpenChange,
  restaurantId,
  areas,
  defaultAreaId,
  table,
  styleTemplate = null,
  nextTableNumber,
  onSaved,
}: DiningTableDrawerProps) {
  const mode = table ? "edit" : "create";
  const [saving, setSaving] = useState(false);
  const [areaId, setAreaId] = useState("");
  const [tableNumber, setTableNumber] = useState(String(nextTableNumber));
  const [tableName, setTableName] = useState("");
  const [capacity, setCapacity] = useState("4");
  const [planX, setPlanX] = useState("15");
  const [planY, setPlanY] = useState("15");
  const [planW, setPlanW] = useState("13");
  const [planH, setPlanH] = useState("20");
  const [colorHex, setColorHex] = useState("#94a3b8");

  const areaItems = useMemo(
    () =>
      Object.fromEntries(
        areas.map((a) => [a.id, `${a.display_number} · ${a.name}`]),
      ),
    [areas],
  );

  useEffect(() => {
    if (!open) return;
    if (table) {
      setAreaId(table.area_id);
      setTableNumber(String(table.table_number));
      setTableName(table.table_name ?? "");
      setCapacity(String(table.capacity));
      setPlanX(String(Number(table.plan_x_pct)));
      setPlanY(String(Number(table.plan_y_pct)));
      setPlanW(String(Number(table.plan_w_pct) || 13));
      setPlanH(String(Number(table.plan_h_pct) || 20));
      setColorHex(HEX.test(table.color_hex) ? table.color_hex : "#94a3b8");
    } else {
      const aid = defaultAreaId ?? areas[0]?.id ?? "";
      setAreaId(aid);
      setTableNumber(String(nextTableNumber));
      setTableName("");
      const src = styleTemplate;
      if (src) {
        setCapacity(String(src.capacity));
        setPlanW(String(Number(src.plan_w_pct) || 13));
        setPlanH(String(Number(src.plan_h_pct) || 20));
        setColorHex(HEX.test(src.color_hex) ? src.color_hex : "#94a3b8");
        const off = 4;
        setPlanX(String(clampPct(Number(src.plan_x_pct) + off)));
        setPlanY(String(clampPct(Number(src.plan_y_pct) + off)));
      } else {
        setCapacity("4");
        setPlanX("15");
        setPlanY("15");
        setPlanW("13");
        setPlanH("20");
      }
    }
  }, [open, table, nextTableNumber, defaultAreaId, areas, styleTemplate]);

  useEffect(() => {
    if (!open || table) return;
    if (!styleTemplate) {
      setColorHex(defaultColorForArea(areas, areaId));
    }
  }, [open, table, areaId, areas, styleTemplate]);

  const fieldClass =
    "h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/45";

  const save = () => {
    if (saving) return;
    const num = Number.parseInt(tableNumber, 10);
    if (!Number.isFinite(num) || num < 1 || num > 999) {
      toast.error("Tischnummer zwischen 1 und 999.");
      return;
    }
    const cap = Number.parseInt(capacity, 10);
    if (!Number.isFinite(cap) || cap < 1 || cap > 50) {
      toast.error("Kapazität zwischen 1 und 50.");
      return;
    }
    const x = Number.parseFloat(planX);
    const y = Number.parseFloat(planY);
    if (!Number.isFinite(x) || x < 0 || x > 100 || !Number.isFinite(y) || y < 0 || y > 100) {
      toast.error("Position 0–100 %.");
      return;
    }
    const w = Number.parseFloat(planW);
    const h = Number.parseFloat(planH);
    if (
      !Number.isFinite(w) ||
      w < FLOOR_PLAN_TABLE_MIN_W_PCT ||
      w > FLOOR_PLAN_TABLE_MAX_W_PCT ||
      !Number.isFinite(h) ||
      h < FLOOR_PLAN_TABLE_MIN_H_PCT ||
      h > FLOOR_PLAN_TABLE_MAX_H_PCT
    ) {
      toast.error(
        `Breite ${FLOOR_PLAN_TABLE_MIN_W_PCT}–${FLOOR_PLAN_TABLE_MAX_W_PCT} %, Höhe ${FLOOR_PLAN_TABLE_MIN_H_PCT}–${FLOOR_PLAN_TABLE_MAX_H_PCT} %.`,
      );
      return;
    }
    if (!areaId) {
      toast.error("Bitte einen Bereich wählen.");
      return;
    }
    const color = HEX.test(colorHex) ? colorHex : "#94a3b8";

    setSaving(true);
    void (async () => {
      if (mode === "edit" && table) {
        const { error } = await updateDiningTable(table.id, {
          area_id: areaId,
          table_number: num,
          table_name: tableName.trim() || null,
          capacity: cap,
          plan_x_pct: x,
          plan_y_pct: y,
          plan_w_pct: w,
          plan_h_pct: h,
          color_hex: color,
        });
        setSaving(false);
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success("Tisch gespeichert.");
      } else {
        const { error } = await insertDiningTable({
          restaurantId,
          areaId,
          tableNumber: num,
          tableName: tableName.trim() || null,
          capacity: cap,
          planXPct: x,
          planYPct: y,
          planWPct: w,
          planHPct: h,
          colorHex: color,
        });
        setSaving(false);
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success("Tisch angelegt.");
      }
      onOpenChange(false);
      onSaved();
    })();
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent
        className="mx-auto flex max-h-[min(92dvh,560px)] max-w-lg flex-col rounded-t-[1.75rem] border-0 bg-card shadow-elevated"
      >
        <DrawerHeader className="shrink-0 px-6 pt-2 pb-2 text-left">
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            {mode === "edit" ? "Tisch bearbeiten" : "Neuer Tisch"}
          </DrawerTitle>
          <DrawerDescription className="text-base">
            Bereich, Nummer und optionaler Name. Ohne Name wird die Nummer angezeigt.
            Farbe und Größe gelten für den Tischplan.
            {!table && styleTemplate
              ? " Voreinstellungen vom zuletzt angelegten Tisch (Position leicht versetzt)."
              : null}
          </DrawerDescription>
        </DrawerHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            if (areas.length === 0 || saving) return;
            save();
          }}
        >
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-4">
          <div className="space-y-1.5">
            <Label htmlFor="dt-area" className="text-xs text-muted-foreground">
              Bereich
            </Label>
            <Select
              value={areaId}
              items={areaItems}
              onValueChange={(v) => {
                if (typeof v === "string") setAreaId(v);
              }}
            >
              <SelectTrigger
                id="dt-area"
                size="sm"
                className={appSelectTriggerAccentCn(
                  "h-11 min-h-11 w-full rounded-xl px-3 text-left text-sm font-normal",
                  selectValueNoShrink,
                )}
              >
                <SelectValue placeholder="Bereich" />
              </SelectTrigger>
              <SelectContent>
                {areas.map((a) => {
                  const dot =
                    /^#[0-9A-Fa-f]{6}$/i.test(a.color_hex) ? a.color_hex : "#64748b";
                  return (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="size-2 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/20"
                          style={{ backgroundColor: dot }}
                          aria-hidden
                        />
                        <span className="font-mono text-xs font-semibold tabular-nums text-muted-foreground">
                          {a.display_number}
                        </span>
                        <span>{a.name}</span>
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="dt-num" className="text-xs text-muted-foreground">
                Nummer
              </Label>
              <Input
                id="dt-num"
                type="number"
                min={1}
                max={999}
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                className={cn(fieldClass, "tabular-nums")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dt-name" className="text-xs text-muted-foreground">
                Name (optional)
              </Label>
              <Input
                id="dt-name"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                className={fieldClass}
                placeholder="z. B. Fensterplatz"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dt-color" className="text-xs text-muted-foreground">
              Tischfarbe (Plan)
            </Label>
            <div className="flex items-center gap-3">
              <input
                id="dt-color"
                type="color"
                value={HEX.test(colorHex) ? colorHex : "#94a3b8"}
                onChange={(e) => setColorHex(e.target.value)}
                className={MENU_TAXONOMY_COLOR_INPUT_CLASSNAME}
                aria-label="Farbe wählen"
              />
              <Input
                value={colorHex}
                onChange={(e) => setColorHex(e.target.value)}
                placeholder="#94a3b8"
                className="h-11 flex-1 rounded-xl font-mono text-sm"
                spellCheck={false}
                maxLength={7}
                aria-label="Farbe als Hex"
              />
            </div>
            <p className="text-xs text-muted-foreground">Hex (#rrggbb), wie beim Bereich.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="dt-cap" className="text-xs text-muted-foreground">
                Kapazität
              </Label>
              <Input
                id="dt-cap"
                type="number"
                min={1}
                max={50}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                className={cn(fieldClass, "tabular-nums")}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="dt-x" className="text-xs text-muted-foreground">
                Plan X %
              </Label>
              <Input
                id="dt-x"
                value={planX}
                onChange={(e) => setPlanX(e.target.value)}
                className={cn(fieldClass, "tabular-nums")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dt-y" className="text-xs text-muted-foreground">
                Plan Y %
              </Label>
              <Input
                id="dt-y"
                value={planY}
                onChange={(e) => setPlanY(e.target.value)}
                className={cn(fieldClass, "tabular-nums")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dt-w" className="text-xs text-muted-foreground">
                Breite %
              </Label>
              <Input
                id="dt-w"
                value={planW}
                onChange={(e) => setPlanW(e.target.value)}
                className={cn(fieldClass, "tabular-nums")}
              />
              <p className="text-[11px] text-muted-foreground">
                {FLOOR_PLAN_TABLE_MIN_W_PCT}–{FLOOR_PLAN_TABLE_MAX_W_PCT} (Canvas)
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dt-h" className="text-xs text-muted-foreground">
                Höhe %
              </Label>
              <Input
                id="dt-h"
                value={planH}
                onChange={(e) => setPlanH(e.target.value)}
                className={cn(fieldClass, "tabular-nums")}
              />
              <p className="text-[11px] text-muted-foreground">
                {FLOOR_PLAN_TABLE_MIN_H_PCT}–{FLOOR_PLAN_TABLE_MAX_H_PCT} (Canvas)
              </p>
            </div>
          </div>
        </div>

        <DrawerFormFooter
          onCancel={() => onOpenChange(false)}
          submitType="submit"
          submitPending={saving}
          submitDisabled={areas.length === 0}
        />
        </form>
      </DrawerContent>
    </Drawer>
  );
}
