export const DEPOSIT_MIN_PARTY_DEFAULT = 1;
export const DEPOSIT_DUE_HOURS_DEFAULT = 24;
export const DEPOSIT_AMOUNT_CENTS_MAX = 1_000_000;

/** Off unless the restaurant saved the switch as on. A missing settings row stays off. */
export function depositIsEnabled(
  row: { deposit_enabled?: boolean | null } | null | undefined,
): boolean {
  return row?.deposit_enabled === true;
}

export function parseDepositMinPartySize(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number.parseInt(trimmed, 10);
  if (n < 1 || n > 200) return null;
  return n;
}

export function parseDepositDueHours(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number.parseInt(trimmed, 10);
  if (n < 0 || n > 720) return null;
  return n;
}

export function parseDepositAmountCents(raw: string): number | null {
  const trimmed = raw.trim().replace(/\s/g, "").replace("€", "");
  if (!trimmed) return null;
  const normalized = trimmed.includes(",")
    ? trimmed.replace(/\./g, "").replace(",", ".")
    : trimmed;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const euros = Number(normalized);
  if (!Number.isFinite(euros) || euros < 0) return null;
  const cents = Math.round(euros * 100);
  if (cents > DEPOSIT_AMOUNT_CENTS_MAX) return null;
  return cents;
}

export function formatDepositAmountInput(cents: number): string {
  const safe = Number.isFinite(cents) ? Math.max(0, Math.round(cents)) : 0;
  return (safe / 100).toFixed(2).replace(".", ",");
}

export function depositNumbersForSave(input: {
  enabled: boolean;
  minPartyRaw: string;
  amountRaw: string;
  dueHoursRaw: string;
}):
  | { ok: true; minParty: number; amountCents: number; dueHours: number }
  | { ok: false; error: string } {
  const party = parseDepositMinPartySize(input.minPartyRaw);
  const cents = parseDepositAmountCents(input.amountRaw);
  const hours = parseDepositDueHours(input.dueHoursRaw);
  if (input.enabled) {
    if (party == null) {
      return {
        ok: false,
        error: "Anzahlung: Personenzahl zwischen 1 und 200.",
      };
    }
    if (cents == null || cents <= 0) {
      return {
        ok: false,
        error: "Anzahlung: Betrag pro Person größer als 0 und höchstens 10.000 €.",
      };
    }
    if (hours == null) {
      return { ok: false, error: "Anzahlung: 0–720 Stunden vor Beginn." };
    }
    return { ok: true, minParty: party, amountCents: cents, dueHours: hours };
  }
  return {
    ok: true,
    minParty: party ?? DEPOSIT_MIN_PARTY_DEFAULT,
    amountCents: cents ?? 0,
    dueHours: hours ?? DEPOSIT_DUE_HOURS_DEFAULT,
  };
}
