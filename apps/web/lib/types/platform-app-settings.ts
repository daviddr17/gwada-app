export const DEFAULT_PLATFORM_APP_NAME = "gwada";

export type PlatformAppBranding = {
  appName: string;
  /** Hellmodus */
  logoUrl: string | null;
  logoPath: string | null;
  /** Dunkelmodus */
  logoDarkUrl: string | null;
  logoDarkPath: string | null;
  faviconUrl: string | null;
  faviconPath: string | null;
};

export type PlatformBrandingAssetKind = "logo" | "logo_dark" | "favicon";
