"use client";

import { useCallback, useRef, useState } from "react";
import { useDrawerFormSeed } from "@/lib/hooks/use-drawer-form-seed";
import { useDrawerFormKeyboardAssist } from "@/lib/hooks/use-drawer-form-keyboard-assist";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { toast } from "sonner";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePickerField } from "@/components/ui/date-picker";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DrawerFormFooter } from "@/components/ui/drawer-form-footer";
import { DrawerFormSection } from "@/components/ui/drawer-form-section";
import {
  staffDrawerFieldClassName,
  staffDrawerScrollClassName,
} from "@/components/staff/staff-form-field-styles";
import {
  deleteStaffWageAdvance,
  upsertStaffWageAdvance,
} from "@/lib/supabase/staff-wage-advances-db";
import type { RestaurantStaffWageAdvanceRow } from "@/lib/types/staff";
import { formatStaffEuroCents } from "@/lib/staff/staff-day-wage";
import { cn } from "@/lib/utils";

function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseEuroToCents(raw: string): number | null {
  const parsed = Number.parseFloat(raw.trim().replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100);
}

type StaffWageAdvanceDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  staffId: string;
  advance: RestaurantStaffWageAdvanceRow | null;
  defaultPaidOn: string;
  allowEdit?: boolean;
  onSaved: () => void;
};

export function StaffWageAdvanceDrawer({
  open,
  onOpenChange,
  restaurantId,
  staffId,
  advance,
  defaultPaidOn,
  allowEdit = true,
  onSaved,
}: StaffWageAdvanceDrawerProps) {
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { repositionInputs } = useDrawerFormKeyboardAssist({ open, scrollRef });
  const readOnly = !allowEdit;

  useDrawerFormSeed(open, advance?.id ?? "__create__", () => {
    if (advance) {
      setAmount(String(advance.amount_cents / 100).replace(".", ","));
      setPaidOn(advance.paid_on);
      setNote(advance.note ?? "");
      return;
    }
    setAmount("");
    setPaidOn(defaultPaidOn || toDateInput(new Date()));
    setNote("");
  });

  const save = useCallback(async () => {
    if (pending || readOnly) return;
    const amountCents = parseEuroToCents(amount);
    if (amountCents == null) {
      toast.error("Bitte einen gültigen Betrag größer als 0 angeben.");
      return;
    }
    if (!paidOn) {
      toast.error("Bitte ein Datum angeben.");
      return;
    }

    setPending(true);
    const res = await upsertStaffWageAdvance({
      restaurantId,
      staffId,
      amountCents,
      paidOn,
      note: note.trim() || null,
      id: advance?.id,
    });
    setPending(false);
    if (!res) {
      toast.error("Lohnvorschuss konnte nicht gespeichert werden.");
      return;
    }
    toast.success(
      advance
        ? "Lohnvorschuss aktualisiert."
        : `Lohnvorschuss ${formatStaffEuroCents(amountCents)} erfasst.`,
    );
    onOpenChange(false);
    onSaved();
  }, [
    pending,
    readOnly,
    amount,
    paidOn,
    note,
    restaurantId,
    staffId,
    advance,
    onOpenChange,
    onSaved,
  ]);

  const handleDelete = useCallback(async () => {
    if (!advance?.id || pending || readOnly) return;
    setPending(true);
    const ok = await deleteStaffWageAdvance(restaurantId, advance.id);
    setPending(false);
    if (!ok) {
      toast.error("Lohnvorschuss konnte nicht gelöscht werden.");
      throw new Error("delete failed");
    }
    toast.success("Lohnvorschuss gelöscht.");
    onOpenChange(false);
    onSaved();
  }, [advance?.id, pending, readOnly, restaurantId, onOpenChange, onSaved]);

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={onOpenChange}
        repositionInputs={repositionInputs}
      >
        <DrawerContent className={drawerContentClassName("formMd")}>
          <DrawerHeader className="shrink-0 border-b border-border/40 px-5 pb-3 pt-4 text-left">
            <DrawerTitle>
              {advance ? "Lohnvorschuss bearbeiten" : "Lohnvorschuss erfassen"}
            </DrawerTitle>
          </DrawerHeader>
          <div ref={scrollRef} className={staffDrawerScrollClassName}>
            <DrawerFormSection contentPadding={5}>
              <div className="space-y-2">
                <Label htmlFor="wage-advance-amount">Betrag</Label>
                <div className="relative">
                  <Input
                    id="wage-advance-amount"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={amount}
                    disabled={readOnly || pending}
                    onChange={(e) => setAmount(e.target.value)}
                    className={cn(staffDrawerFieldClassName, "pr-10")}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                    €
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Datum</Label>
                <DatePickerField
                  value={paidOn}
                  onChange={setPaidOn}
                  disabled={readOnly || pending}
                  fullWidth
                  className={staffDrawerFieldClassName}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wage-advance-note">Notiz (optional)</Label>
                <Textarea
                  id="wage-advance-note"
                  value={note}
                  disabled={readOnly || pending}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  maxLength={500}
                  className="min-h-20 rounded-xl"
                  placeholder="z. B. Bar ausgezahlt"
                />
              </div>
            </DrawerFormSection>
          </div>
          <DrawerFormFooter
            contentPadding={5}
            onCancel={() => onOpenChange(false)}
            submitLabel="Speichern"
            submitPending={pending}
            submitDisabled={readOnly || pending}
            submitType="button"
            onSubmit={() => void save()}
            showSubmit={!readOnly}
            showDelete={Boolean(advance) && !readOnly}
            onDelete={() => setConfirmDelete(true)}
            deleteLabel="Löschen"
            deleteDisabled={pending}
          />
        </DrawerContent>
      </Drawer>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Lohnvorschuss löschen?"
        description="Der Eintrag wird dauerhaft entfernt und erscheint nicht mehr in der Abrechnung."
        confirmLabel="Löschen"
        destructive
        onConfirm={handleDelete}
      />
    </>
  );
}
