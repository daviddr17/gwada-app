"use client";

import { useEffect, useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { DrawerFormFooter } from "@/components/ui/drawer-form-footer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { accountingFormControlClassName } from "@/lib/ui/accounting-form-styles";

export function AccountingCashOpeningBalanceDrawer({
  open,
  onOpenChange,
  initialBalance,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialBalance: number;
  onSave: (openingBalance: number) => Promise<void>;
}) {
  const [value, setValue] = useState("0");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValue(String(initialBalance));
  }, [open, initialBalance]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
      <DrawerContent className="mx-auto max-w-lg rounded-t-[1.75rem]">
        <DrawerHeader>
          <DrawerTitle>Anfangsbestand</DrawerTitle>
          <DrawerDescription>
            Kassenstand zu Beginn der Buchführung — wird zum Berechnen des
            aktuellen Bestands addiert.
          </DrawerDescription>
        </DrawerHeader>
        <form
          className="space-y-4 px-4 pb-4"
          onSubmit={(e) => {
            e.preventDefault();
            void (async () => {
              setSaving(true);
              try {
                await onSave(Number(value) || 0);
                onOpenChange(false);
              } finally {
                setSaving(false);
              }
            })();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="cash-opening-balance">Betrag</Label>
            <Input
              id="cash-opening-balance"
              type="number"
              step="0.01"
              className={accountingFormControlClassName}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
            />
          </div>
          <DrawerFormFooter
            onCancel={() => onOpenChange(false)}
            submitLabel="Speichern"
            submitPending={saving}
          />
        </form>
      </DrawerContent>
    </Drawer>
  );
}
