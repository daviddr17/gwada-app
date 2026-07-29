"use client";

import { Label } from "@/components/ui/label";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/ui/combobox";
import {
  estimateTableExportPageCount,
  tableExportRowsPerPageSelectOptions,
  type TableExportRowsPerPage,
} from "@/lib/export/table-export-rows-per-page";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { staffDrawerFieldClassName } from "@/components/staff/staff-form-field-styles";
import { cn } from "@/lib/utils";

const selectClassName = appSelectTriggerAccentCn(staffDrawerFieldClassName);

const OPTIONS: SearchableSelectOption[] = tableExportRowsPerPageSelectOptions();

type TableExportRowsPerPageFieldProps = {
  value: TableExportRowsPerPage;
  onChange: (value: TableExportRowsPerPage) => void;
  itemCount: number;
  className?: string;
};

export function TableExportRowsPerPageField({
  value,
  onChange,
  itemCount,
  className,
}: TableExportRowsPerPageFieldProps) {
  const pages = estimateTableExportPageCount(itemCount, value);

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor="table-export-rows-per-page">Artikel pro Seite</Label>
      <SearchableSelect
        id="table-export-rows-per-page"
        options={OPTIONS}
        value={String(value)}
        onValueChange={(raw) => {
          const n = Number.parseInt(raw, 10);
          if (
            Number.isFinite(n) &&
            OPTIONS.some((o) => o.value === String(n))
          ) {
            onChange(n as TableExportRowsPerPage);
          }
        }}
        placeholder="Artikel pro Seite"
        searchPlaceholder="Anzahl suchen…"
        aria-label="Artikel pro Seite"
        className={selectClassName}
      />
      <p className="text-xs text-muted-foreground">
        Zeilenhöhe und Schrift werden angepasst
        {itemCount > 0
          ? ` · ca. ${pages} Seite${pages === 1 ? "" : "n"} bei ${itemCount} Einträgen`
          : ""}
        .
      </p>
    </div>
  );
}
