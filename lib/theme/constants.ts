/** Default brand accent (warm gold) – später pro Restaurant/Tenant. */
export const DEFAULT_ACCENT_HEX = "#eab308";

export const ACCENT_STORAGE_KEY = "gwada-brand-accent";

/** Multi-tenant branding shape (API-ready). */
export type RestaurantBranding = {
  tenantId: string;
  name: string;
  accentHex: string;
  logoUrl?: string;
};
