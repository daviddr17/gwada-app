"use client";

import { useEffect, useMemo, useState } from "react";
import { GuestPhoneField } from "@/components/phone/guest-phone-field";
import { SearchableSelect } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ContactOriginallyEmptyFields } from "@/lib/accounting/accounting-contact-recipient";
import {
  COUNTRIES_REFERENCE_FALLBACK,
  resolveCountryIso2FromLabel,
  type CountryReference,
} from "@/lib/constants/countries";
import { formatGuestPhone, parseGuestPhone } from "@/lib/phone/guest-phone";
import { fetchCountries } from "@/lib/supabase/countries-db";
import type { AccountingRecipientSnapshot } from "@/lib/types/accounting";
import {
  accountingFormControlClassName,
  accountingFormGridClassName,
  accountingFormSelectClassName,
} from "@/lib/ui/accounting-form-styles";
import { cn } from "@/lib/utils";

function ReadOnlyValue({ value }: { value: string }) {
  return (
    <div
      className={cn(
        accountingFormControlClassName,
        "flex items-center bg-muted/25 text-foreground",
      )}
    >
      {value}
    </div>
  );
}

function RecipientField({
  label,
  value,
  editable,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  editable: boolean;
  onChange: (value: string) => void;
  type?: "text" | "email";
}) {
  if (!editable && !value.trim()) return null;

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {editable ? (
        <Input
          className={accountingFormControlClassName}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <ReadOnlyValue value={value} />
      )}
    </div>
  );
}

function CountryRecipientField({
  countryCode,
  countries,
  editable,
  onCountryChange,
}: {
  countryCode: string | null | undefined;
  countries: CountryReference[];
  editable: boolean;
  onCountryChange: (iso2: string) => void;
}) {
  const countryIso = useMemo(
    () => resolveCountryIso2FromLabel(countryCode ?? "", countries),
    [countryCode, countries],
  );

  const countryOptions = useMemo(
    () =>
      countries.map((c) => ({
        value: c.iso2,
        label: `${c.flag_emoji} ${c.name_de}`,
      })),
    [countries],
  );

  const showField = editable || Boolean(countryCode?.trim());
  if (!showField) return null;

  return (
    <div className="space-y-2">
      <Label>Land</Label>
      <SearchableSelect
        value={countryIso}
        onValueChange={onCountryChange}
        options={countryOptions}
        disabled={!editable}
        searchPlaceholder="Land suchen …"
        emptyText="Kein Land gefunden"
        className={cn(
          accountingFormSelectClassName,
          !editable && "pointer-events-none opacity-100",
        )}
      />
    </div>
  );
}

function PhoneRecipientField({
  phone,
  countryCode,
  countries,
  editable,
  onPhoneChange,
}: {
  phone: string | null | undefined;
  countryCode: string | null | undefined;
  countries: CountryReference[];
  editable: boolean;
  onPhoneChange: (phone: string | null) => void;
}) {
  const defaultIso = resolveCountryIso2FromLabel(countryCode ?? "", countries);
  const [phoneIso, setPhoneIso] = useState(defaultIso);
  const [phoneLocal, setPhoneLocal] = useState("");

  useEffect(() => {
    const parsed = parseGuestPhone(phone, countries, defaultIso);
    setPhoneIso(parsed.iso2);
    setPhoneLocal(parsed.local);
  }, [phone, countries, defaultIso]);

  const showField = editable || Boolean(phone?.trim());
  if (!showField) return null;

  const updatePhone = (iso2: string, local: string) => {
    setPhoneIso(iso2);
    setPhoneLocal(local);
    if (!editable) return;
    const formatted = formatGuestPhone(iso2, local, countries);
    onPhoneChange(formatted);
  };

  return (
    <div className="space-y-2 sm:col-span-2">
      <Label>Telefon</Label>
      <GuestPhoneField
        countries={countries}
        countryIso={phoneIso}
        localValue={phoneLocal}
        disabled={!editable}
        onCountryChange={(iso2) => updatePhone(iso2, phoneLocal)}
        onLocalChange={(local) => updatePhone(phoneIso, local)}
        localPlaceholder="Nummer"
      />
    </div>
  );
}

export function AccountingContactRecipientFields({
  recipient,
  originallyEmpty,
  onRecipientChange,
}: {
  recipient: AccountingRecipientSnapshot;
  originallyEmpty: ContactOriginallyEmptyFields;
  onRecipientChange: (
    patch: Partial<AccountingRecipientSnapshot>,
  ) => void;
}) {
  const [countries, setCountries] = useState<CountryReference[]>(
    COUNTRIES_REFERENCE_FALLBACK,
  );

  useEffect(() => {
    void fetchCountries().then(({ data }) => {
      if (data.length > 0) setCountries(data);
    });
  }, []);

  const countryIso = useMemo(
    () => resolveCountryIso2FromLabel(recipient.countryCode ?? "", countries),
    [recipient.countryCode, countries],
  );

  return (
    <div className={cn(accountingFormGridClassName, "sm:col-span-2")}>
      <div className="space-y-2 sm:col-span-2">
        <RecipientField
          label="Name"
          value={recipient.name}
          editable={originallyEmpty.name}
          onChange={(name) => onRecipientChange({ name })}
        />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <RecipientField
          label="Straße"
          value={recipient.street ?? ""}
          editable={originallyEmpty.street}
          onChange={(street) => onRecipientChange({ street })}
        />
      </div>
      <RecipientField
        label="PLZ"
        value={recipient.zip ?? ""}
        editable={originallyEmpty.zip}
        onChange={(zip) => onRecipientChange({ zip })}
      />
      <RecipientField
        label="Ort"
        value={recipient.city ?? ""}
        editable={originallyEmpty.city}
        onChange={(city) => onRecipientChange({ city })}
      />
      <CountryRecipientField
        countryCode={recipient.countryCode}
        countries={countries}
        editable={originallyEmpty.country}
        onCountryChange={(iso2) => onRecipientChange({ countryCode: iso2 })}
      />
      <RecipientField
        label="E-Mail"
        value={recipient.email ?? ""}
        editable={originallyEmpty.email}
        type="email"
        onChange={(email) => onRecipientChange({ email })}
      />
      <PhoneRecipientField
        phone={recipient.phone}
        countryCode={countryIso}
        countries={countries}
        editable={originallyEmpty.phone}
        onPhoneChange={(phone) => onRecipientChange({ phone })}
      />
    </div>
  );
}
