export type PosRestaurantPaymentMethodKind =
  | "cash"
  | "unbar"
  | "voucher"
  | "custom";

export type PosRestaurantPaymentMethodRow = {
  id: string;
  restaurant_id: string;
  kind: PosRestaurantPaymentMethodKind;
  label: string;
  sort_order: number;
  is_active: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
};

/** Client-/Pay-DTO inkl. ob die Art jetzt kassierbar ist. */
export type PosRestaurantPaymentMethodDto = PosRestaurantPaymentMethodRow & {
  /** false z. B. für Unbar-Platzhalter (Mollie/Adyen folgt). */
  collectable: boolean;
  /** TSE/DSFinV-K: Bar vs Unbar. */
  fiscalClass: "cash" | "non_cash";
};

export function posPaymentMethodFiscalClass(
  kind: PosRestaurantPaymentMethodKind,
): "cash" | "non_cash" {
  return kind === "cash" ? "cash" : "non_cash";
}

/** Mapping auf bestehendes pos_payment_method Enum für Pipeline/TSE. */
export function posPaymentMethodEnumForKind(
  kind: PosRestaurantPaymentMethodKind,
): "cash" | "card" | "voucher" {
  if (kind === "cash") return "cash";
  if (kind === "voucher") return "voucher";
  // unbar + custom → Unbar (Placeholder bis Adyen/Mollie)
  return "card";
}

export function isPosPaymentMethodCollectable(
  kind: PosRestaurantPaymentMethodKind,
): boolean {
  // Unbar: Anbindung Zahlungsdienstleister folgt
  if (kind === "unbar") return false;
  return true;
}
