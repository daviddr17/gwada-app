import type { PosFulfillmentType, PosOrderChannel } from "@gwada/pos-domain";

export type DeliveryZone = {
  postalCode: string;
  feeCents?: number;
  minOrderCents?: number;
};

export const DEFAULT_NOTIFY_STATUSES = [
  "received",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
  "cancelled",
] as const;

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
  timeslotsEnabled: boolean;
  slotIntervalMinutes: number;
  slotCapacity: number;
  slotHorizonHours: number;
  kioskMollieTerminalId: string | null;
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
  /** ISO start of chosen timeslot */
  slotStartAt?: string;
  /** Mollie terminal for counter kiosk pointofsale */
  mollieTerminalId?: string;
  /** Prefer terminal payment (kiosk); default true for channel=kiosk */
  payWithTerminal?: boolean;
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
  timeslotsEnabled: false,
  slotIntervalMinutes: 15,
  slotCapacity: 8,
  slotHorizonHours: 24,
  kioskMollieTerminalId: null,
};
