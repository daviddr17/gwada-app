"use client";

import { useState } from "react";
import { useDrawerFormSeed } from "@/lib/hooks/use-drawer-form-seed";
import { drawerScrollAreaClassName, drawerFormHeaderClassName } from "@/lib/ui/drawer-form-section";
import { DrawerFormSection } from "@/components/ui/drawer-form-section";
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

  useDrawerFormSeed(open, "__opening_balance__", () => {
    setValue(String(initialBalance));
  });

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
          className="flex min-h-0 flex-1 flex-col"
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
          <div className={drawerScrollAreaClassName(4)}>
            <DrawerFormSection contentPadding={4}>
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
            </DrawerFormSection>
          </div>
          <DrawerFormFooter
            contentPadding={4}
            onCancel={() => onOpenChange(false)}
            submitLabel="Speichern"
            submitPending={saving}
          />
        </form>
      </DrawerContent>
    </Drawer>
  );
}
