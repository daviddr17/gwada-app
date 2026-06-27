"use client";

import type {
  ComplianceChecklistItem,
  ComplianceRecordValues,
} from "@/lib/types/compliance";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SearchableSelect } from "@/components/ui/combobox";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { cn } from "@/lib/utils";

const selectClass = appSelectTriggerAccentCn("h-11 w-full rounded-xl");
const touchInputClass =
  "h-12 rounded-xl text-base tabular-nums md:h-11 md:text-sm";

type ComplianceRecordFieldsProps = {
  items: ComplianceChecklistItem[];
  values: ComplianceRecordValues;
  onChange: (next: ComplianceRecordValues) => void;
  large?: boolean;
};

export function ComplianceRecordFields({
  items,
  values,
  onChange,
  large = false,
}: ComplianceRecordFieldsProps) {
  const setValue = (
    itemId: string,
    value: string | number | boolean | null,
  ) => {
    onChange({
      ...values,
      [itemId]: { value, withinLimits: null },
    });
  };

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const entry = values[item.id];
        const inputClass = cn(large ? touchInputClass : "rounded-xl");

        return (
          <div key={item.id} className="space-y-2">
            <Label>
              {item.label}
              {item.required !== false ? (
                <span className="text-destructive"> *</span>
              ) : null}
            </Label>

            {item.fieldType === "boolean" ? (
              <div className="flex items-center justify-between rounded-xl border border-border/40 bg-muted/10 px-4 py-3">
                <span className="text-sm">Erledigt / in Ordnung</span>
                <Switch
                  checked={entry?.value === true}
                  onCheckedChange={(checked) => setValue(item.id, checked)}
                />
              </div>
            ) : null}

            {item.fieldType === "select" ? (
              <SearchableSelect
                value={String(entry?.value ?? "")}
                onValueChange={(v) => setValue(item.id, v)}
                options={(item.options ?? ["OK", "Nicht OK"]).map((o) => ({
                  value: o,
                  label: o,
                }))}
                className={selectClass}
              />
            ) : null}

            {(item.fieldType === "temperature" || item.fieldType === "number") && (
              <div className="space-y-1">
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={
                    entry?.value != null && entry.value !== ""
                      ? String(entry.value)
                      : ""
                  }
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") setValue(item.id, null);
                    else setValue(item.id, Number.parseFloat(raw.replace(",", ".")));
                  }}
                  placeholder="°C"
                  className={inputClass}
                />
                {item.minValue != null || item.maxValue != null ? (
                  <p className="text-xs text-muted-foreground">
                    Soll:{" "}
                    {item.minValue != null && item.maxValue != null
                      ? `${item.minValue} °C – ${item.maxValue} °C`
                      : item.maxValue != null
                        ? `max. ${item.maxValue} °C`
                        : `min. ${item.minValue} °C`}
                  </p>
                ) : null}
              </div>
            )}

            {item.fieldType === "text" ? (
              <Input
                value={String(entry?.value ?? "")}
                onChange={(e) => setValue(item.id, e.target.value)}
                className={inputClass}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
