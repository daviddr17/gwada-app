"use client";

import { GuestPhoneCountrySelect } from "@/components/phone/guest-phone-country-select";
import type { CountryReference } from "@/lib/constants/countries";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { cn } from "@/lib/utils";

const selectValueNoShrink =
  "[&_[data-slot=select-value]]:!min-w-0 [&_[data-slot=select-value]]:!shrink-0 [&_[data-slot=select-value]]:!grow-0 [&_[data-slot=select-value]]:overflow-visible [&_[data-slot=select-value]]:whitespace-nowrap";

/** Unified phone field shell (country + local number) — reservation bottom sheet reference. */
export const guestPhoneFieldGroupClassName =
  "flex h-11 w-full min-w-0 overflow-hidden rounded-xl border border-input bg-transparent transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/45";

export const guestPhoneFieldSeparatorClassName =
  "shrink-0 self-center px-0.5 text-sm leading-none text-muted-foreground/60 select-none";

export function guestPhonePrefixTriggerClassName(...extra: Array<string | undefined>) {
  return appSelectTriggerAccentCn(
    "h-11 min-h-11 w-[5.5rem] shrink-0 rounded-none border-0 bg-transparent px-1.5 shadow-none hover:bg-muted/40 focus-visible:ring-0 data-popup-open:ring-0 dark:hover:bg-input/40 [&_[data-slot=select-value]]:gap-1",
    selectValueNoShrink,
    ...extra,
  );
}

export const guestPhoneNumberInputClassName =
  "h-11 min-h-0 w-full min-w-0 flex-1 rounded-none border-0 bg-transparent px-3 text-sm tabular-nums shadow-none outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-0 focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50";

type GuestPhoneFieldProps = {
  countryIso: string;
  onCountryChange: (iso2: string) => void;
  localValue: string;
  onLocalChange: (value: string) => void;
  countries: CountryReference[];
  disabled?: boolean;
  countryId?: string;
  localId?: string;
  localPlaceholder?: string;
  invalid?: boolean;
  className?: string;
  localAutoComplete?: string;
  /** Auf Tablet/Mobil: `numeric` statt Telefon-Tastatur. */
  localInputMode?: "tel" | "numeric";
  /** Display-Tablet: höheres Feld (h-12). */
  tall?: boolean;
};

export function GuestPhoneField({
  countryIso,
  onCountryChange,
  localValue,
  onLocalChange,
  countries,
  disabled,
  countryId,
  localId,
  localPlaceholder = "Nummer",
  invalid,
  className,
  localAutoComplete = "tel-national",
  localInputMode = "tel",
  tall = false,
}: GuestPhoneFieldProps) {
  const tallClass = tall ? "h-12 text-base" : "";
  return (
    <div className={cn(guestPhoneFieldGroupClassName, tall && "h-12", className)}>
      <GuestPhoneCountrySelect
        id={countryId}
        value={countryIso}
        countries={countries}
        disabled={disabled}
        invalid={invalid}
        triggerClassName={guestPhonePrefixTriggerClassName(
          tall ? "h-12 min-h-12" : undefined,
        )}
        onValueChange={onCountryChange}
      />
      <span className={guestPhoneFieldSeparatorClassName} aria-hidden>
        |
      </span>
      <input
        id={localId}
        value={localValue}
        onChange={(e) => onLocalChange(e.target.value)}
        className={cn(guestPhoneNumberInputClassName, tallClass)}
        inputMode={localInputMode}
        autoComplete={localAutoComplete}
        placeholder={localPlaceholder}
        disabled={disabled}
        aria-invalid={invalid || undefined}
      />
    </div>
  );
}
