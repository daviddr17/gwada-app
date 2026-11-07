import type { PosFulfillmentType, PosOrderChannel } from "@gwada/pos-domain";
import type {
  GuestPaymentMethodId,
  GuestPaymentMethodsConfig,
} from "@/lib/ordering/guest-payment-methods";
import {
  DEFAULT_GUEST_PAY_KIOSK,
  DEFAULT_GUEST_PAY_ONLINE,
} from "@/lib/ordering/guest-payment-methods";

export type DeliveryZone = {
  postalCode: string;
  feeCents?: number;
  minOrderCents?: number;
};

export type { GuestPaymentMethodId, GuestPaymentMethodsConfig };

export const DEFAULT_NOTIFY_STATUSES = [
  "received",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
  "cancelled",
] as const;

export type SoldOutGuestDisplay = "hide" | "grey";

export type OnlineOrderingSettings = {
  restaurantId: string;
  onlineEnabled: boolean;
  kioskEnabled: boolean;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  minOrderCentsPickup: number;
  minOrderCentsDelivery: number;
  deliveryFeeCents: number;
  deliveryZones: DeliveryZone[];
  pickupLeadMinutes: number;
  deliveryLeadMinutes: number;
  kioskIdleSeconds: number;
  guestStatusMessage: string | null;
  notifyWhatsappEnabled: boolean;
  notifyEmailEnabled: boolean;
  notifyStatuses: string[];
  /**
   * Legacy timeslot capacity model — no longer guest-facing.
   * Kept for DB round-trip; UI uses Mindestvorlauf (pickup/delivery lead) only.
   */
  timeslotsEnabled: boolean;
  slotIntervalMinutes: number;
  slotCapacity: number;
  slotHorizonHours: number;
  kioskMollieTerminalId: string | null;
  /** Guest sold-out tiles: hide (default) or greyed/disabled. */
  soldOutGuestDisplay: SoldOutGuestDisplay;
  /**
   * Opt-in live inventory check on guest menu/checkout.
   * Default OFF — separate from POS inventory_booking_enabled.
   */
  guestLiveStockCheckEnabled: boolean;
  /** Online guest checkout methods (Gwada-owned selection). */
  guestPayOnline: GuestPaymentMethodsConfig;
  /** Kiosk / table guest checkout methods. */
  guestPayKiosk: GuestPaymentMethodsConfig;
};

export type OnlineOrderingSettingsPatch = Partial<
  Omit<OnlineOrderingSettings, "restaurantId">
>;

export type PublicOrderingRecipeIngredient = {
  ingredientId: string;
  name: string;
};

export type GuestOrderLineInput = {
  menuItemId: string;
  quantity: number;
  notes?: string;
  ohneIngredientIds?: string[];
  modifiers?: Array<{
    type: "ohne" | "option" | "text";
    label: string;
    ingredientId?: string;
    optionChoiceId?: string;
    priceDeltaCents?: number;
  }>;
};

export type GuestCheckoutInput = {
  channel: Extract<PosOrderChannel, "online" | "kiosk" | "table">;
  fulfillmentType: PosFulfillmentType;
  guestName: string;
  guestPhone?: string;
  guestEmail?: string;
  deliveryAddress?: string;
  deliveryCity?: string;
  deliveryPostalCode?: string;
  deliveryNotes?: string;
  diningTableId?: string;
  /**
   * Online only: `asap` = Schnellstmöglich, `scheduled` = Wunschzeit.
   * Kiosk/table always forced to asap server-side.
   */
  timingMode?: "asap" | "scheduled";
  /** ISO datetime for Wunschzeit (required when timingMode=scheduled) */
  scheduledAt?: string;
  /** @deprecated use timingMode + scheduledAt */
  slotStartAt?: string;
  /** Mollie terminal for counter kiosk pointofsale */
  mollieTerminalId?: string;
  /**
   * @deprecated Prefer `paymentMethod`. Kept for older clients.
   * Prefer terminal payment (kiosk); default true for channel=kiosk
   */
  payWithTerminal?: boolean;
  /**
   * Gwada checkout method. Required for new clients.
   * Server rejects methods that are disabled in restaurant settings.
   */
  paymentMethod?: GuestPaymentMethodId;
  items: GuestOrderLineInput[];
  notes?: string;
};

export type OrderingTimeslot = {
  startAt: string;
  endAt: string;
  remaining: number;
  label: string;
};

export const DEFAULT_ONLINE_ORDERING_SETTINGS: Omit<
  OnlineOrderingSettings,
  "restaurantId"
> = {
  onlineEnabled: false,
  kioskEnabled: false,
  pickupEnabled: true,
  deliveryEnabled: false,
  minOrderCentsPickup: 0,
  minOrderCentsDelivery: 0,
  deliveryFeeCents: 0,
  deliveryZones: [],
  pickupLeadMinutes: 20,
  deliveryLeadMinutes: 45,
  kioskIdleSeconds: 90,
  guestStatusMessage: null,
  notifyWhatsappEnabled: true,
  notifyEmailEnabled: true,
  notifyStatuses: [...DEFAULT_NOTIFY_STATUSES],
  /** Capacity slots demoted — lead time is the product model. */
  timeslotsEnabled: false,
  slotIntervalMinutes: 15,
  slotCapacity: 8,
  slotHorizonHours: 24,
  kioskMollieTerminalId: null,
  soldOutGuestDisplay: "hide",
  guestLiveStockCheckEnabled: false,
  guestPayOnline: { ...DEFAULT_GUEST_PAY_ONLINE },
  guestPayKiosk: { ...DEFAULT_GUEST_PAY_KIOSK },
};
