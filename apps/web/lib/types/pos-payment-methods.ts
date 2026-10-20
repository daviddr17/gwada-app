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
  /** false wenn kein Terminal / Mollie Connect fehlt. */
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
): "cash" | "card" | "terminal" {
  if (kind === "cash") return "cash";
  if (kind === "unbar") return "terminal";
  return "card";
}

export function isPosPaymentMethodCollectable(
  kind: PosRestaurantPaymentMethodKind,
): boolean {
  // Unbar → Mollie Terminals API; Kassieren braucht verbundene Terminals.
  if (kind === "unbar") return true;
  return true;
}
