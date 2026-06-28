"use client";

import { Plus, Trash2 } from "lucide-react";
import { SearchableSelect } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AccountingTaxRateRow } from "@/lib/types/accounting";
import type { AccountingCashEntryTaxLineInput } from "@/lib/types/accounting-cash-book";
import { computeVoucherItemTaxAmount } from "@/lib/accounting/compute-voucher-totals";
import {
  accountingFormControlClassName,
  accountingFormSelectClassName,
} from "@/lib/ui/accounting-form-styles";
import { cn } from "@/lib/utils";
import { moduleDataTableHeadLabelClassName } from "@/lib/ui/module-data-table";

export type CashTaxLineDraft = AccountingCashEntryTaxLineInput & {
  clientId: string;
};

export function createEmptyCashTaxLineDraft(
  taxRatePercent = 0,
): CashTaxLineDraft {
  return {
    clientId: crypto.randomUUID(),
    amount: 0,
    tax_rate_percent: taxRatePercent,
  };
}

export function cashTaxLineDraftsFromEntry(
  lines: Array<{ amount: number; tax_rate_percent: number }> | undefined,
  fallbackRate: number,
): CashTaxLineDraft[] {
  if (lines?.length) {
    return lines.map((line) => ({
      clientId: crypto.randomUUID(),
      amount: line.amount,
      tax_rate_percent: line.tax_rate_percent,
    }));
  }
  return [createEmptyCashTaxLineDraft(fallbackRate)];
}

export function AccountingCashTaxLinesEditor({
  lines,
  taxRates,
  disabled,
  onChange,
}: {
  lines: CashTaxLineDraft[];
  taxRates: AccountingTaxRateRow[];
  disabled?: boolean;
  onChange: (lines: CashTaxLineDraft[]) => void;
}) {
  const taxOptions = taxRates.map((t) => ({
    value: String(t.rate_percent),
    label: t.label,
  }));

  const updateLine = (clientId: string, patch: Partial<CashTaxLineDraft>) => {
    onChange(
      lines.map((line) =>
        line.clientId === clientId ? { ...line, ...patch } : line,
      ),
    );
  };

  const totalGross =
    Math.round(
      lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0) * 100,
    ) / 100;

  const totalTax =
    Math.round(
      lines.reduce((sum, line) => {
        const amount = Number(line.amount) || 0;
        const rate = Number(line.tax_rate_percent) || 0;
        return sum + computeVoucherItemTaxAmount(amount, rate, "gross");
      }, 0) * 100,
    ) / 100;

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "hidden sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.5rem] sm:gap-2",
          moduleDataTableHeadLabelClassName,
        )}
      >
        <span>Betrag (brutto)</span>
        <span>Steuersatz</span>
        <span />
      </div>
      {lines.map((line) => (
        <div
          key={line.clientId}
          className="grid gap-2 rounded-xl border border-border/50 bg-muted/10 p-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.5rem] sm:items-center"
        >
          <Input
            disabled={disabled}
            className={accountingFormControlClassName}
            type="number"
            min={0.01}
            step="0.01"
            value={line.amount || ""}
            onChange={(e) =>
              updateLine(line.clientId, { amount: Number(e.target.value) || 0 })
            }
            placeholder="0,00"
            aria-label="Betrag"
          />
          <SearchableSelect
            disabled={disabled}
            value={String(line.tax_rate_percent)}
            onValueChange={(value) =>
              updateLine(line.clientId, {
                tax_rate_percent: Number(value) || 0,
              })
            }
            options={taxOptions}
            className={accountingFormSelectClassName}
            placeholder="Steuersatz"
            searchPlaceholder="Steuersatz …"
            aria-label="Steuersatz"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-destructive"
            disabled={disabled || lines.length <= 1}
            aria-label="Steuerposition entfernen"
            onClick={() =>
              onChange(lines.filter((item) => item.clientId !== line.clientId))
            }
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-full"
        disabled={disabled}
        onClick={() =>
          onChange([
            ...lines,
            createEmptyCashTaxLineDraft(
              Number(taxRates.find((t) => t.is_default)?.rate_percent ?? 0),
            ),
          ])
        }
      >
        <Plus className="size-4" />
        Steuerposition
      </Button>
      <div className="space-y-1 text-right text-sm tabular-nums text-muted-foreground">
        <p>
          Summe brutto:{" "}
          <span className="font-medium text-foreground">
            {totalGross.toLocaleString("de-DE", {
              style: "currency",
              currency: "EUR",
            })}
          </span>
        </p>
        <p>
          Enthaltene MwSt.:{" "}
          <span className="font-medium text-foreground">
            {totalTax.toLocaleString("de-DE", {
              style: "currency",
              currency: "EUR",
            })}
          </span>
        </p>
      </div>
    </div>
  );
}
