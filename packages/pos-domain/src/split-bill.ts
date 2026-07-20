/**
 * Split-Bill State Machine (Prototyp-Regeln).
 *
 * Zwei Modi:
 * - `item`  — Zahlung pro Person (Positionen)
 * - `amount`— Gleich teilen / settled-Pool
 *
 * Einbahnstraße: sobald ein Anteil (`amount`) gebucht wurde, ist Person-Zahlung gesperrt.
 * Invariante: Summe aller Zahlungen (ohne Trinkgeld) = ursprüngliche offene Rechnungssumme.
 */

export type SettlementMode = "item" | "amount";

export type SplitBillState = {
  mode: SettlementMode;
  /** Noch offener Warenwert in Cent (ohne Tip). */
  openCents: number;
  /** Bereits über amount-Anteile beglichen (Pool). */
  settledCents: number;
  /** Verbleibende Anteile beim Gleich-Teilen (zählt nach Zahlung runter). */
  evenN: number;
};

export type SplitPaymentKind = "person" | "share" | "rest";

export type SplitPaymentResult =
  | { ok: true; state: SplitBillState; chargedCents: number; kind: SplitPaymentKind }
  | { ok: false; error: SplitBillError };

export type SplitBillError =
  | "nothing_open"
  | "person_locked_after_share"
  | "invalid_even_n"
  | "invalid_amount";

export function createSplitBillState(openCents: number, evenN = 2): SplitBillState {
  const open = Math.max(0, Math.round(openCents));
  const n = clampEvenN(evenN);
  return { mode: "item", openCents: open, settledCents: 0, evenN: n };
}

export function clampEvenN(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(12, Math.max(1, Math.round(n)));
}

/** Person-Kassieren nur im item-Modus und ohne settled-Pool. */
export function canPayPerson(state: SplitBillState): boolean {
  return state.mode === "item" && state.settledCents === 0 && state.openCents > 0;
}

/**
 * Anteil = open / evenN, auf 10 ct aufgerundet; letzter Anteil (evenN === 1) = exakter Rest.
 * Nie größer als open.
 */
export function computeShareCents(openCents: number, evenN: number): number {
  const open = Math.max(0, Math.round(openCents));
  const n = clampEvenN(evenN);
  if (open <= 0) return 0;
  if (n <= 1) return open;
  const raw = Math.ceil(open / n / 10) * 10;
  return Math.min(open, raw);
}

export function applyPersonPayment(
  state: SplitBillState,
  personOpenCents: number,
): SplitPaymentResult {
  if (!canPayPerson(state)) {
    return { ok: false, error: "person_locked_after_share" };
  }
  const amount = Math.round(personOpenCents);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "invalid_amount" };
  }
  if (amount > state.openCents) {
    return { ok: false, error: "invalid_amount" };
  }
  return {
    ok: true,
    kind: "person",
    chargedCents: amount,
    state: {
      ...state,
      openCents: state.openCents - amount,
    },
  };
}

export function applySharePayment(state: SplitBillState): SplitPaymentResult {
  if (state.openCents <= 0) {
    return { ok: false, error: "nothing_open" };
  }
  const n = clampEvenN(state.evenN);
  if (n < 1) {
    return { ok: false, error: "invalid_even_n" };
  }
  const charged = computeShareCents(state.openCents, n);
  if (charged <= 0) {
    return { ok: false, error: "nothing_open" };
  }
  return {
    ok: true,
    kind: "share",
    chargedCents: charged,
    state: {
      mode: "amount",
      openCents: state.openCents - charged,
      settledCents: state.settledCents + charged,
      evenN: Math.max(1, n - 1),
    },
  };
}

export function applyRestPayment(state: SplitBillState): SplitPaymentResult {
  if (state.openCents <= 0) {
    return { ok: false, error: "nothing_open" };
  }
  const charged = state.openCents;
  return {
    ok: true,
    kind: "rest",
    chargedCents: charged,
    state: {
      mode: state.settledCents > 0 || state.mode === "amount" ? "amount" : state.mode,
      openCents: 0,
      settledCents: state.settledCents + charged,
      evenN: 1,
    },
  };
}

/** True wenn nichts mehr offen (Tisch → Status bezahlt / Freigabe möglich). */
export function isSplitFullyPaid(state: SplitBillState): boolean {
  return state.openCents <= 0;
}
