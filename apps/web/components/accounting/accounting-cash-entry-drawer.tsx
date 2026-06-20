"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerScrollAreaClassName, drawerFormHeaderClassName } from "@/lib/ui/drawer-form-section";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DrawerFormSection } from "@/components/ui/drawer-form-section";
import {
  AccountingCashTaxLinesEditor,
  cashTaxLineDraftsFromEntry,
  createEmptyCashTaxLineDraft,
  type CashTaxLineDraft,
} from "@/components/accounting/accounting-cash-tax-lines-editor";
import { SearchableSelect } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { fetchAccountingVoucher, fetchAccountingVouchers } from "@/lib/accounting/accounting-api";
import { voucherLabelForPicker } from "@/lib/accounting/accounting-cash-display";
import { ACCOUNTING_CASH_DIRECTION_LABELS } from "@/lib/accounting/accounting-cash-book-defaults";
import type {
  AccountingCashCategoryRow,
  AccountingCashDirection,
  AccountingCashEntryRow,
  AccountingCashEntryTaxLineInput,
} from "@/lib/types/accounting-cash-book";
import type { AccountingTaxRateRow, AccountingVoucherRow } from "@/lib/types/accounting";
import {
  accountingFormControlClassName,
  accountingFormGridClassName,
  accountingFormSelectClassName,
} from "@/lib/ui/accounting-form-styles";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";

const DIRECTION_OPTIONS: { value: AccountingCashDirection; label: string }[] = [
  { value: "income", label: "Einnahme" },
  { value: "expense", label: "Ausgabe" },
];

const NO_VOUCHER = "__none__";

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function AccountingCashEntryDrawer({
  open,
  onOpenChange,
  restaurantId,
  initial,
  categories,
  taxRates,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  initial: AccountingCashEntryRow | null;
  categories: AccountingCashCategoryRow[];
  taxRates: AccountingTaxRateRow[];
  onSave: (payload: {
    entry_date: string;
    direction: AccountingCashDirection;
    category_id: string;
    note?: string | null;
    voucher_id?: string | null;
    tax_lines: AccountingCashEntryTaxLineInput[];
  }) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}) {
  const [entryDate, setEntryDate] = useState(todayIsoDate());
  const [direction, setDirection] = useState<AccountingCashDirection>("income");
  const [categoryId, setCategoryId] = useState("");
  const [note, setNote] = useState("");
  const [voucherId, setVoucherId] = useState<string | null>(null);
  const [taxLines, setTaxLines] = useState<CashTaxLineDraft[]>([]);
  const [voucherOptions, setVoucherOptions] = useState<AccountingVoucherRow[]>(
    [],
  );
  const [loadingVouchers, setLoadingVouchers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const defaultTaxRate = useMemo(() => {
    const def = taxRates.find((t) => t.is_default);
    return Number(def?.rate_percent ?? taxRates[0]?.rate_percent ?? 0);
  }, [taxRates]);

  const loadVoucherOptions = useCallback(async () => {
    setLoadingVouchers(true);
    try {
      const result = await fetchAccountingVouchers(restaurantId, {
        pageSize: 100,
        sort: "voucher_date",
        sortDir: "desc",
      });
      setVoucherOptions(result.items);
    } catch {
      toast.error("Belege konnten nicht geladen werden.");
    } finally {
      setLoadingVouchers(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    if (!open) return;
    void loadVoucherOptions();
  }, [open, loadVoucherOptions]);

  useEffect(() => {
    if (!open) return;
    setEntryDate(initial?.entry_date ?? todayIsoDate());
    setDirection(initial?.direction ?? "income");
    setCategoryId(initial?.category_id ?? "");
    setNote(initial?.note ?? "");
    setVoucherId(initial?.voucher_id ?? null);
    setTaxLines(
      cashTaxLineDraftsFromEntry(
        initial?.tax_lines?.map((line) => ({
          amount: line.amount,
          tax_rate_percent: line.taxRatePercent,
        })),
        defaultTaxRate,
      ),
    );
  }, [open, initial, defaultTaxRate]);

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.direction === direction && !c.archived),
    [categories, direction],
  );

  useEffect(() => {
    if (!open) return;
    if (filteredCategories.some((c) => c.id === categoryId)) return;
    setCategoryId(filteredCategories[0]?.id ?? "");
  }, [open, direction, filteredCategories, categoryId]);

  const voucherSelectOptions = useMemo(
    () => [
      { value: NO_VOUCHER, label: "Kein Beleg" },
      ...voucherOptions.map((voucher) => ({
        value: voucher.id,
        label: voucherLabelForPicker(voucher),
      })),
    ],
    [voucherOptions],
  );

  const importTaxLinesFromVoucher = async (nextVoucherId: string) => {
    try {
      const voucher = await fetchAccountingVoucher(restaurantId, nextVoucherId);
      if (!voucher.voucher_items.length) {
        toast.message("Beleg ohne Steuerpositionen — Beträge manuell eintragen.");
        return;
      }
      setTaxLines(
        voucher.voucher_items.map((item) => ({
          clientId: crypto.randomUUID(),
          amount: item.amount,
          tax_rate_percent: item.taxRatePercent,
        })),
      );
      toast.success("Steuerpositionen vom Beleg übernommen.");
    } catch {
      toast.error("Beleg konnte nicht geladen werden.");
    }
  };

  const handleVoucherChange = (value: string) => {
    if (value === NO_VOUCHER) {
      setVoucherId(null);
      return;
    }
    setVoucherId(value);
    const hasOnlyEmptyDefault =
      taxLines.length === 1 && (Number(taxLines[0]?.amount) || 0) <= 0;
    if (hasOnlyEmptyDefault || taxLines.length === 0) {
      void importTaxLinesFromVoucher(value);
    }
  };

  const canDelete = Boolean(initial && onDelete);

  const handleConfirmDelete = async () => {
    if (!initial || !onDelete) return;
    setDeleting(true);
    try {
      await onDelete(initial.id);
      setConfirmDeleteOpen(false);
      onOpenChange(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
        <DrawerContent className={drawerContentClassName("form")}>
          <DrawerHeader className="shrink-0">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1 text-left">
                <DrawerTitle>
                  {initial ? "Buchung bearbeiten" : "Neue Buchung"}
                </DrawerTitle>
                <DrawerDescription>
                  Bareinnahme oder -ausgabe mit Steuersplit, optional verknüpftem
                  Beleg und Notiz.
                </DrawerDescription>
              </div>
              {canDelete ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label="Buchung löschen"
                  onClick={() => setConfirmDeleteOpen(true)}
                >
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </div>
          </DrawerHeader>
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(e) => {
              e.preventDefault();
              void (async () => {
                if (!categoryId) {
                  toast.error("Bitte eine Art wählen.");
                  return;
                }
                const validLines = taxLines.filter(
                  (line) => (Number(line.amount) || 0) > 0,
                );
                if (validLines.length === 0) {
                  toast.error("Mindestens eine Steuerposition mit Betrag nötig.");
                  return;
                }
                setSaving(true);
                try {
                  await onSave({
                    entry_date: entryDate,
                    direction,
                    category_id: categoryId,
                    note: note.trim() || null,
                    voucher_id: voucherId,
                    tax_lines: validLines.map(({ amount, tax_rate_percent }) => ({
                      amount,
                      tax_rate_percent,
                    })),
                  });
                  onOpenChange(false);
                } finally {
                  setSaving(false);
                }
              })();
            }}
          >
            <div className={drawerScrollAreaClassName(4)}>
              <DrawerFormSection contentPadding={4} title="Buchung">
              <div className={accountingFormGridClassName}>
                <div className="space-y-2">
                  <Label htmlFor="cash-entry-date">Datum</Label>
                  <Input
                    id="cash-entry-date"
                    type="date"
                    className={accountingFormControlClassName}
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cash-entry-direction">Richtung</Label>
                  <SearchableSelect
                    id="cash-entry-direction"
                    value={direction}
                    onValueChange={(v) =>
                      setDirection(v as AccountingCashDirection)
                    }
                    options={DIRECTION_OPTIONS}
                    className={accountingFormSelectClassName}
                    placeholder="Richtung"
                    searchPlaceholder="Richtung …"
                    aria-label="Einnahme oder Ausgabe"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cash-entry-category">
                  Art ({ACCOUNTING_CASH_DIRECTION_LABELS[direction]})
                </Label>
                <SearchableSelect
                  id="cash-entry-category"
                  value={categoryId}
                  onValueChange={setCategoryId}
                  options={filteredCategories.map((c) => ({
                    value: c.id,
                    label: c.name,
                  }))}
                  className={appSelectTriggerAccentCn("h-10 w-full")}
                  placeholder="Art wählen"
                  searchPlaceholder="Art …"
                  aria-label="Art der Buchung"
                  disabled={filteredCategories.length === 0}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cash-entry-voucher">Beleg (optional)</Label>
                <SearchableSelect
                  id="cash-entry-voucher"
                  value={voucherId ?? NO_VOUCHER}
                  onValueChange={handleVoucherChange}
                  options={voucherSelectOptions}
                  className={appSelectTriggerAccentCn("h-10 w-full")}
                  placeholder="Beleg wählen"
                  searchPlaceholder="Beleg suchen …"
                  aria-label="Beleg zuordnen"
                  disabled={loadingVouchers}
                />
                <p className="text-xs text-muted-foreground">
                  Beim Zuordnen werden Steuerpositionen vom Beleg übernommen, wenn
                  noch keine Beträge eingetragen sind.
                </p>
              </div>
              </DrawerFormSection>

              <DrawerFormSection contentPadding={4} title="Steuerpositionen">
              <AccountingCashTaxLinesEditor
                  lines={
                    taxLines.length > 0
                      ? taxLines
                      : [createEmptyCashTaxLineDraft(defaultTaxRate)]
                  }
                  taxRates={taxRates}
                  disabled={saving || deleting}
                  onChange={setTaxLines}
                />
              </DrawerFormSection>

              <DrawerFormSection contentPadding={4} title="Notiz">
              <div className="space-y-2">
                <Label htmlFor="cash-entry-note">Notiz</Label>
                <Textarea
                  id="cash-entry-note"
                  className={accountingFormControlClassName}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Wofür war diese Buchung?"
                  rows={3}
                />
              </div>
              </DrawerFormSection>
            </div>
            <DrawerFormFooter
              contentPadding={4}
              onCancel={() => onOpenChange(false)}
              submitLabel={initial ? "Speichern" : "Buchen"}
              submitPending={saving}
              submitDisabled={!categoryId || filteredCategories.length === 0}
            />
          </form>
        </DrawerContent>
      </Drawer>

      {canDelete ? (
        <ConfirmDialog
          open={confirmDeleteOpen}
          onOpenChange={setConfirmDeleteOpen}
          title="Buchung wirklich löschen?"
          description="Die Buchung wird dauerhaft entfernt. Der Kassenbestand wird neu berechnet."
          confirmLabel="Löschen"
          destructive
          confirmDisabled={deleting}
          onConfirm={() => void handleConfirmDelete()}
        />
      ) : null}
    </>
  );
}
