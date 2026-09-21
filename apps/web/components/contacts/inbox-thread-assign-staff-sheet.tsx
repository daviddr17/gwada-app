"use client";

import { useEffect, useMemo, useState } from "react";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/combobox";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  drawerFormHeaderClassName,
} from "@/lib/ui/drawer-form-section";
import { Label } from "@/components/ui/label";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { fetchStaffForRestaurant } from "@/lib/supabase/staff-db";
import { staffDisplayName } from "@/lib/types/staff";
import { cn } from "@/lib/utils";

export type InboxThreadAssignStaffKind = "phone" | "email";

type InboxThreadAssignStaffSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string | null;
  kind: InboxThreadAssignStaffKind;
  valueDisplay: string;
  assigning?: boolean;
  stackAboveInboxOverlay?: boolean;
  onAssign: (staffId: string, staffLabel: string) => void | Promise<void>;
};

export function InboxThreadAssignStaffSheet({
  open,
  onOpenChange,
  restaurantId,
  kind,
  valueDisplay,
  assigning = false,
  stackAboveInboxOverlay = false,
  onAssign,
}: InboxThreadAssignStaffSheetProps) {
  const [staff, setStaff] = useState<
    { id: string; label: string; phone: string | null; email: string | null }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    if (!open || !restaurantId) {
      setSelectedId("");
      return;
    }

    let cancelled = false;
    setLoading(true);
    void fetchStaffForRestaurant(restaurantId).then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        setStaff([]);
      } else {
        setStaff(
          data
            .filter((row) => row.is_active)
            .map((row) => ({
              id: row.id,
              label: staffDisplayName(row),
              phone: row.phone?.trim() || null,
              email: row.email?.trim() || null,
            })),
        );
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [open, restaurantId]);

  const options = useMemo(
    () =>
      staff.map((row) => {
        const existing = kind === "email" ? row.email : row.phone;
        return {
          value: row.id,
          label: existing ? `${row.label} · ${existing}` : row.label,
        };
      }),
    [kind, staff],
  );

  const selected = staff.find((row) => row.id === selectedId) ?? null;
  const replacesExisting = Boolean(
    kind === "email" ? selected?.email : selected?.phone,
  );

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent
        className={cn(
          drawerContentClassName("assign"),
          stackAboveInboxOverlay && "z-[210]",
        )}
      >
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            {kind === "email"
              ? "E-Mail Mitarbeiter zuordnen"
              : "Nummer Mitarbeiter zuordnen"}
          </DrawerTitle>
          <DrawerDescription className="text-sm text-muted-foreground">
            {kind === "email"
              ? `${valueDisplay} einem Teammitglied als E-Mail speichern.`
              : `${valueDisplay} einem Teammitglied als Telefonnummer speichern.`}
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pb-6">
          <div className="space-y-2">
            <Label>Mitarbeiter</Label>
            <SearchableSelect
              value={selectedId}
              onValueChange={setSelectedId}
              options={options}
              placeholder={
                loading
                  ? "Mitarbeiter werden geladen …"
                  : options.length
                    ? "Mitarbeiter suchen …"
                    : "Keine Mitarbeiter vorhanden"
              }
              disabled={loading || assigning || options.length === 0}
              className={appSelectTriggerAccentCn("h-11 w-full")}
            />
          </div>

          {replacesExisting ? (
            <p className="text-sm text-muted-foreground">
              {kind === "email"
                ? `Die bisherige E-Mail von ${selected?.label} wird ersetzt.`
                : `Die bisherige Nummer von ${selected?.label} wird ersetzt.`}
            </p>
          ) : null}

          <Button
            type="button"
            className={cn("h-11 w-full", brandActionButtonRoundedClassName)}
            disabled={!selectedId || assigning || loading}
            onClick={() => {
              if (!selected) return;
              onOpenChange(false);
              void onAssign(selected.id, selected.label);
            }}
          >
            {assigning ? "Wird zugeordnet …" : "Zuordnen"}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
