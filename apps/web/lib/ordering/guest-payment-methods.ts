/**
 * Guest checkout payment methods (Online + Kiosk).
 * Selection lives in Gwada UI; Mollie is backend-only (terminal / pointofsale / API).
 */

export const GUEST_PAYMENT_METHOD_IDS = [
  "card_terminal",
  "cash",
  "paypal",
  "softpos",
] as const;

export type GuestPaymentMethodId = (typeof GUEST_PAYMENT_METHOD_IDS)[number];

export type GuestPaymentMethodsConfig = {
  cardTerminal: boolean;
  cash: boolean;
  paypal: boolean;
  softpos: boolean;
};

export const DEFAULT_GUEST_PAY_ONLINE: GuestPaymentMethodsConfig = {
  cardTerminal: false,
  cash: true,
  paypal: false,
  softpos: false,
};

export const DEFAULT_GUEST_PAY_KIOSK: GuestPaymentMethodsConfig = {
  cardTerminal: true,
  cash: false,
  paypal: false,
  softpos: false,
};

export function isGuestPaymentMethodId(
  value: unknown,
): value is GuestPaymentMethodId {
  return (
    typeof value === "string" &&
    (GUEST_PAYMENT_METHOD_IDS as readonly string[]).includes(value)
  );
}

export function normalizeGuestPaymentMethods(
  raw: Partial<GuestPaymentMethodsConfig> | null | undefined,
  fallback: GuestPaymentMethodsConfig,
): GuestPaymentMethodsConfig {
  return {
    cardTerminal: Boolean(raw?.cardTerminal ?? fallback.cardTerminal),
    cash: Boolean(raw?.cash ?? fallback.cash),
    paypal: Boolean(raw?.paypal ?? fallback.paypal),
    softpos: Boolean(raw?.softpos ?? fallback.softpos),
  };
}

export function guestPaymentMethodsForChannel(
  channel: "online" | "kiosk" | "table",
  online: GuestPaymentMethodsConfig,
  kiosk: GuestPaymentMethodsConfig,
): GuestPaymentMethodsConfig {
  return channel === "online" ? online : kiosk;
}

export function isGuestPaymentMethodEnabled(
  methods: GuestPaymentMethodsConfig,
  method: GuestPaymentMethodId,
): boolean {
  switch (method) {
    case "card_terminal":
      return methods.cardTerminal;
    case "cash":
      return methods.cash;
    case "paypal":
      return methods.paypal;
    case "softpos":
      return methods.softpos;
    default:
      return false;
  }
}

/** Methods that need a Mollie term_… (pointofsale). */
export function guestPaymentMethodNeedsTerminal(
  method: GuestPaymentMethodId,
): boolean {
  return method === "card_terminal" || method === "softpos";
}

export function guestPaymentMethodLabelDe(method: GuestPaymentMethodId): string {
  switch (method) {
    case "card_terminal":
      return "Karte / Terminal";
    case "cash":
      return "Bar";
    case "paypal":
      return "PayPal";
    case "softpos":
      return "Tippen / SoftPOS";
    default:
      return method;
  }
}

export function enabledGuestPaymentMethodIds(
  methods: GuestPaymentMethodsConfig,
): GuestPaymentMethodId[] {
  return GUEST_PAYMENT_METHOD_IDS.filter((id) =>
    isGuestPaymentMethodEnabled(methods, id),
  );
}
