"use client";

import { useMemo } from "react";
import { toast } from "sonner";
import { SearchableSelect } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { staffDrawerFieldClassName } from "@/components/staff/staff-form-field-styles";
import {
  ACCOUNTING_FILTER_ALL,
  ACCOUNTING_VARIANT_FILTER_LABELS,
  ACCOUNTING_VOUCHER_KIND_FILTER_LABELS,
  type AccountingDocumentVariantFilter,
  type AccountingVoucherKindFilter,
} from "@/lib/constants/accounting-list-filters";
import {
  ACCOUNTING_FILTER_LABELS,
  ACCOUNTING_PLATFORMS,
  type AccountingPlatformFilter,
} from "@/lib/constants/accounting-platforms";
import { accountingStatusSelectOptions } from "@/lib/accounting/accounting-status-labels";
import type { AccountingDocumentStatusRow } from "@/lib/types/accounting";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { cn } from "@/lib/utils";

const accountingFilterSelectClassName = appSelectTriggerAccentCn(
  staffDrawerFieldClassName,
);

export type AccountingFilterDrawerMode = "invoice" | "quotation" | "voucher";

type AccountingFilterDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: AccountingFilterDrawerMode;
  platformFilter: AccountingPlatformFilter;
  onPlatformFilterChange: (value: AccountingPlatformFilter) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  variantFilter: AccountingDocumentVariantFilter;
  onVariantFilterChange: (value: AccountingDocumentVariantFilter) => void;
  voucherKindFilter: AccountingVoucherKindFilter;
  onVoucherKindFilterChange: (value: AccountingVoucherKindFilter) => void;
  statuses: AccountingDocumentStatusRow[];
  connectorConnected: boolean;
};

const MODE_DESCRIPTION: Record<AccountingFilterDrawerMode, string> = {
  invoice: "Rechnungen nach Quelle, Status und Dokumenttyp eingrenzen.",
  quotation: "Angebote nach Quelle und Status eingrenzen.",
  voucher: "Belege nach Quelle, Status, Belegart und Dokumenttyp eingrenzen.",
};

export function AccountingFilterDrawer({
  open,
  onOpenChange,
  mode,
  platformFilter,
  onPlatformFilterChange,
  statusFilter,
  onStatusFilterChange,
  variantFilter,
  onVariantFilterChange,
  voucherKindFilter,
  onVoucherKindFilterChange,
  statuses,
  connectorConnected,
}: AccountingFilterDrawerProps) {
  const platformOptions = useMemo(() => {
    const options: { value: string; label: string; disabled?: boolean }[] = [
      { value: ACCOUNTING_FILTER_ALL, label: ACCOUNTING_FILTER_LABELS.all },
    ];
    for (const platform of ACCOUNTING_PLATFORMS) {
      options.push({
        value: platform,
        label: ACCOUNTING_FILTER_LABELS[platform],
        disabled: platform !== "gwada" && !connectorConnected,
      });
    }
    return options;
  }, [connectorConnected]);

  const statusOptions = useMemo(
    () => [
      { value: ACCOUNTING_FILTER_ALL, label: "Alle Status" },
      ...accountingStatusSelectOptions(statuses).map((s) => ({
        value: s.value,
        label: s.label,
      })),
    ],
    [statuses],
  );

  const variantOptions = useMemo(
    () =>
      (
        Object.entries(ACCOUNTING_VARIANT_FILTER_LABELS) as [
          AccountingDocumentVariantFilter,
          string,
        ][]
      ).map(([value, label]) => ({ value, label })),
    [],
  );

  const voucherKindOptions = useMemo(
    () =>
      (
        Object.entries(ACCOUNTING_VOUCHER_KIND_FILTER_LABELS) as [
          AccountingVoucherKindFilter,
          string,
        ][]
      ).map(([value, label]) => ({ value, label })),
    [],
  );

  const resetFilters = () => {
    onPlatformFilterChange(ACCOUNTING_FILTER_ALL);
    onStatusFilterChange(ACCOUNTING_FILTER_ALL);
    onVariantFilterChange(ACCOUNTING_FILTER_ALL);
    onVoucherKindFilterChange(ACCOUNTING_FILTER_ALL);
    toast.success("Filter zurückgesetzt");
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent className="mx-auto flex max-h-[min(92dvh,560px)] max-w-lg flex-col overflow-hidden rounded-t-[1.75rem] border-0 bg-card shadow-elevated">
        <DrawerHeader className="shrink-0 px-6 pt-2 pb-2 text-left">
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Filter
          </DrawerTitle>
          <DrawerDescription className="text-base">
            {MODE_DESCRIPTION[mode]}
          </DrawerDescription>
        </DrawerHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overflow-x-hidden overscroll-contain px-6 pb-2">
          <div className="space-y-3">
            <Label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Quelle
            </Label>
            <SearchableSelect
              options={platformOptions}
              value={platformFilter}
              onValueChange={(value) =>
                onPlatformFilterChange(value as AccountingPlatformFilter)
              }
              placeholder="Alle Quellen"
              searchPlaceholder="Quelle suchen …"
              aria-label="Quelle filtern"
              className={accountingFilterSelectClassName}
            />
          </div>

          <div className="space-y-3">
            <Label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Status
            </Label>
            <SearchableSelect
              options={statusOptions}
              value={statusFilter}
              onValueChange={onStatusFilterChange}
              placeholder="Alle Status"
              searchPlaceholder="Status suchen …"
              aria-label="Status filtern"
              className={accountingFilterSelectClassName}
            />
          </div>

          {mode === "voucher" ? (
            <>
              <Separator />
              <div className="space-y-3">
                <Label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Belegart
                </Label>
                <SearchableSelect
                  options={voucherKindOptions}
                  value={voucherKindFilter}
                  onValueChange={(value) =>
                    onVoucherKindFilterChange(value as AccountingVoucherKindFilter)
                  }
                  placeholder="Alle Belegarten"
                  searchPlaceholder="Belegart suchen …"
                  aria-label="Belegart filtern"
                  className={accountingFilterSelectClassName}
                />
              </div>
            </>
          ) : null}

          {mode === "invoice" || mode === "voucher" ? (
            <div className="space-y-3">
              <Label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Dokumenttyp
              </Label>
              <SearchableSelect
                options={variantOptions}
                value={variantFilter}
                onValueChange={(value) =>
                  onVariantFilterChange(value as AccountingDocumentVariantFilter)
                }
                placeholder="Alle Typen"
                searchPlaceholder="Typ suchen …"
                aria-label="Dokumenttyp filtern"
                className={accountingFilterSelectClassName}
              />
            </div>
          ) : null}
        </div>

        <Separator />

        <div className="flex gap-3 px-6 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <Button
            type="button"
            variant="outline"
            className="h-12 flex-1 rounded-xl tap-scale"
            onClick={resetFilters}
          >
            Zurücksetzen
          </Button>
          <Button
            type="button"
            className={cn("h-12 flex-1", brandActionButtonRoundedClassName)}
            onClick={() => onOpenChange(false)}
          >
            Fertig
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
