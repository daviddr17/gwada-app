"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { computeVoucherItemTaxAmount } from "@/lib/accounting/compute-voucher-totals";
import type { AccountingVoucherItem } from "@/lib/types/accounting";
import { accountingFormControlClassName } from "@/lib/ui/accounting-form-styles";

export function createEmptyVoucherItem(): AccountingVoucherItem {
  return {
    id: crypto.randomUUID(),
    sortOrder: 0,
    label: "",
    amount: 0,
    taxAmount: 0,
    taxRatePercent: 19,
    categoryLabel: null,
  };
}

type AccountingVoucherItemsEditorProps = {
  items: AccountingVoucherItem[];
  taxMode: "net" | "gross";
  disabled?: boolean;
  onChange: (items: AccountingVoucherItem[]) => void;
};

export function AccountingVoucherItemsEditor({
  items,
  taxMode,
  disabled,
  onChange,
}: AccountingVoucherItemsEditorProps) {
  const updateItem = (id: string, patch: Partial<AccountingVoucherItem>) => {
    onChange(
      items.map((item) => {
        if (item.id !== id) return item;
        const amount =
          patch.amount !== undefined ? Number(patch.amount) || 0 : item.amount;
        const taxRatePercent =
          patch.taxRatePercent !== undefined
            ? Number(patch.taxRatePercent) || 0
            : item.taxRatePercent;
        const taxAmount = computeVoucherItemTaxAmount(
          amount,
          taxRatePercent,
          taxMode,
        );
        return {
          ...item,
          ...patch,
          amount,
          taxRatePercent,
          taxAmount,
        };
      }),
    );
  };

  return (
    <div className="space-y-2">
      <div className="hidden text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_2.5rem] sm:gap-2">
        <span>Bezeichnung</span>
        <span>Kategorie</span>
        <span>Betrag</span>
        <span>Steuer %</span>
        <span />
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          className="grid gap-2 rounded-xl border border-border/50 bg-muted/10 p-2 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_2.5rem] sm:items-center"
        >
          <Input
            disabled={disabled}
            className={accountingFormControlClassName}
            placeholder="Position"
            value={item.label}
            onChange={(e) => updateItem(item.id, { label: e.target.value })}
          />
          <Input
            disabled={disabled}
            className={accountingFormControlClassName}
            placeholder="Kategorie"
            value={item.categoryLabel ?? ""}
            onChange={(e) =>
              updateItem(item.id, { categoryLabel: e.target.value || null })
            }
          />
          <Input
            disabled={disabled}
            className={accountingFormControlClassName}
            type="number"
            min={0}
            step="0.01"
            value={item.amount || ""}
            onChange={(e) => updateItem(item.id, { amount: Number(e.target.value) })}
          />
          <Input
            disabled={disabled}
            className={accountingFormControlClassName}
            type="number"
            min={0}
            step="0.1"
            value={item.taxRatePercent || ""}
            onChange={(e) =>
              updateItem(item.id, { taxRatePercent: Number(e.target.value) })
            }
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-destructive"
            disabled={disabled || items.length <= 1}
            aria-label="Position entfernen"
            onClick={() => onChange(items.filter((x) => x.id !== item.id))}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-lg"
        disabled={disabled}
        onClick={() => onChange([...items, createEmptyVoucherItem()])}
      >
        <Plus className="size-4" />
        Steuerposition
      </Button>
    </div>
  );
}
