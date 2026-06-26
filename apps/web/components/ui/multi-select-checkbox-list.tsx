"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export type MultiSelectOption = {
  value: string;
  label: string;
};

type MultiSelectCheckboxListProps = {
  options: MultiSelectOption[];
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  emptyMessage?: string;
  className?: string;
};

export function MultiSelectCheckboxList({
  options,
  value,
  onChange,
  disabled,
  emptyMessage = "Keine Einträge verfügbar.",
  className,
}: MultiSelectCheckboxListProps) {
  if (options.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  const toggle = (id: string, checked: boolean) => {
    if (checked) {
      if (!value.includes(id)) onChange([...value, id]);
      return;
    }
    onChange(value.filter((v) => v !== id));
  };

  return (
    <div className={cn("space-y-1 rounded-xl border border-border/40 p-2", className)}>
      {options.map((opt) => {
        const checked = value.includes(opt.value);
        return (
          <label
            key={opt.value}
            className={cn(
              "flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-sm hover:bg-muted/30",
              disabled && "pointer-events-none opacity-50",
            )}
          >
            <Checkbox
              checked={checked}
              disabled={disabled}
              onCheckedChange={(c) => toggle(opt.value, c === true)}
            />
            <span className="min-w-0 flex-1">{opt.label}</span>
          </label>
        );
      })}
    </div>
  );
}
