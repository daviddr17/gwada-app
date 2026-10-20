import type { PosFulfillmentType, PosOrderChannel } from "@gwada/pos-domain";

export type DeliveryZone = {
  postalCode: string;
  feeCents?: number;
  minOrderCents?: number;
};

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
  items: GuestOrderLineInput[];
  notes?: string;
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
};
