/** Öffentliches Plattform-Profil (Settings → Integrationen). */

export type IntegrationPlatformProfile = {
  name: string;
  description: string;
  phone: string;
  website: string;
  address: string;
};

export const EMPTY_INTEGRATION_PLATFORM_PROFILE: IntegrationPlatformProfile = {
  name: "",
  description: "",
  phone: "",
  website: "",
  address: "",
};

export type IntegrationPlatformProfileProvider =
  | "google_business"
  | "facebook"
  | "instagram";
