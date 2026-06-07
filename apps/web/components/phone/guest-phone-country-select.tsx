"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  findCountryByIso2,
  type CountryReference,
} from "@/lib/constants/countries";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { cn } from "@/lib/utils";

export function GuestPhoneCountrySelect({
  value,
  onValueChange,
  countries,
  disabled,
  id,
  triggerClassName,
  invalid,
  "aria-label": ariaLabel = "Landesvorwahl",
}: {
  value: string;
  onValueChange: (iso2: string) => void;
  countries: CountryReference[];
  disabled?: boolean;
  id?: string;
  triggerClassName?: string;
  invalid?: boolean;
  "aria-label"?: string;
}) {
  const selected = findCountryByIso2(value, countries);

  return (
    <Select
      value={value}
      disabled={disabled}
      items={Object.fromEntries(
        countries.map((c) => [c.iso2, `${c.flag_emoji} ${c.dial_code}`]),
      )}
      onValueChange={(v) => {
        if (typeof v === "string") onValueChange(v);
      }}
    >
      <SelectTrigger
        id={id}
        size="sm"
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        className={cn(
          appSelectTriggerAccentCn(
            "h-10 w-[5.5rem] shrink-0 rounded-xl px-2 [&_[data-slot=select-value]]:gap-1",
          ),
          triggerClassName,
        )}
      >
        {selected ? (
          <span className="flex items-center gap-1">
            <span aria-hidden>{selected.flag_emoji}</span>
            <span className="tabular-nums">{selected.dial_code}</span>
          </span>
        ) : (
          <SelectValue placeholder="+49" />
        )}
      </SelectTrigger>
      <SelectContent>
        {countries.map((c) => (
          <SelectItem key={c.iso2} value={c.iso2}>
            <span className="flex items-center gap-2">
              <span aria-hidden>{c.flag_emoji}</span>
              <span className="tabular-nums">{c.dial_code}</span>
              <span className="text-muted-foreground">{c.name_de}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
