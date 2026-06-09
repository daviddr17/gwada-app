/** Messaging-/Social-Integrationen fürs Dashboard (kein Login-OAuth). */

export type DashboardIntegrationChannelId =
  | "whatsapp"
  | "email"
  | "facebook"
  | "instagram"
  | "google_business"
  | "lexoffice";

export type DashboardIntegrationChannelMeta = {
  id: DashboardIntegrationChannelId;
  label: string;
  shortLabel: string;
};

export const DASHBOARD_INTEGRATION_CHANNELS: readonly DashboardIntegrationChannelMeta[] =
  [
    { id: "whatsapp", label: "WhatsApp", shortLabel: "WA" },
    { id: "email", label: "E-Mail", shortLabel: "Mail" },
    { id: "facebook", label: "Facebook", shortLabel: "FB" },
    { id: "instagram", label: "Instagram", shortLabel: "IG" },
    {
      id: "google_business",
      label: "Google Business",
      shortLabel: "Google",
    },
    { id: "lexoffice", label: "Lexware Office", shortLabel: "Lexware" },
  ] as const;

export type DashboardIntegrationItem = DashboardIntegrationChannelMeta & {
  connected: boolean;
};

export type DashboardIntegrationsSummary = {
  items: DashboardIntegrationItem[];
  connectedCount: number;
  totalCount: number;
};
