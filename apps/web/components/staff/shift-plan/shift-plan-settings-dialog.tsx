"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { DrawerFormFooter } from "@/components/ui/drawer-form-footer";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { upsertShiftScheduleSettings } from "@/lib/supabase/staff-shift-schedule-db";

type ShiftPlanSettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  requiresAcceptance: boolean;
  onSaved: (requiresAcceptance: boolean) => void;
};

export function ShiftPlanSettingsDialog({
  open,
  onOpenChange,
  restaurantId,
  requiresAcceptance,
  onSaved,
}: ShiftPlanSettingsDialogProps) {
  const [value, setValue] = useState(requiresAcceptance);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValue(requiresAcceptance);
  }, [open, requiresAcceptance]);

  const save = async () => {
    setPending(true);
    const { error } = await upsertShiftScheduleSettings(restaurantId, value);
    setPending(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Einstellungen gespeichert.");
    onSaved(value);
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
      <DrawerContent className={drawerContentClassName("export")}>
        <DrawerHeader className="shrink-0 px-6 pt-2 pb-3 text-left">
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Schichtplan-Einstellungen
          </DrawerTitle>
          <DrawerDescription className="text-base">
            Legt fest, wie geplante Schichten für Mitarbeiter wirksam werden.
          </DrawerDescription>
        </DrawerHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="px-6 pb-4">
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 bg-muted/10 px-4 py-3">
              <div className="space-y-0.5">
                <Label htmlFor="requires-acceptance" className="text-sm font-medium">
                  Bestätigung erforderlich
                </Label>
                <p className="text-xs text-muted-foreground">
                  Mitarbeiter müssen geplante Schichten im Profil annehmen, bevor
                  sie als bestätigt gelten.
                </p>
              </div>
              <Switch
                id="requires-acceptance"
                checked={value}
                onCheckedChange={setValue}
              />
            </div>
          </div>

          <DrawerFormFooter
            onCancel={() => onOpenChange(false)}
            submitType="submit"
            submitPending={pending}
          />
        </form>
      </DrawerContent>
    </Drawer>
  );
}
