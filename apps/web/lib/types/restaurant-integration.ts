export type RestaurantIntegrationKey = "whatsapp" | "email" | "facebook";

export type RestaurantEmailStatus = "default" | "custom";

import type { SmtpIntegrationConfigPublic } from "@/lib/integrations/smtp-integration-config";

export type RestaurantEmailIntegrationConfig = {
  from_email?: string;
  from_name?: string;
} & SmtpIntegrationConfigPublic;

export type RestaurantEmailIntegrationRow = {
  restaurant_id: string;
  integration_key: "email";
  status: RestaurantEmailStatus;
  config: RestaurantEmailIntegrationConfig;
  last_error: string | null;
  updated_at: string;
};

export type EmailIntegrationResponse = {
  configured: boolean;
  /** Plattform-SMTP (Service-Role) für Versand aus der App verfügbar. */
  emailSendConfigured: boolean;
  platformEmailEnabled: boolean;
  status: RestaurantEmailStatus;
  fromEmail: string | null;
  fromName: string | null;
  smtpHost: string | null;
  smtpPort: string | null;
  imapHost: string | null;
  imapPort: string | null;
  passwordConfigured: boolean;
  defaultFromEmail: string;
  defaultFromName: string;
  message?: string;
};

export type RestaurantWhatsappStatus =
  | "disconnected"
  | "starting"
  | "scan_qr"
  | "working"
  | "failed"
  | "stopped";

export type RestaurantWhatsappIntegrationRow = {
  restaurant_id: string;
  integration_key: RestaurantIntegrationKey;
  waha_session_name: string;
  status: RestaurantWhatsappStatus;
  phone_number: string | null;
  display_name: string | null;
  connected_at: string | null;
  last_error: string | null;
  updated_at: string;
};

export type WahaSessionStatus =
  | "STOPPED"
  | "STARTING"
  | "SCAN_QR_CODE"
  | "WORKING"
  | "FAILED"
  | string;

export type WahaConnectResponse = {
  configured: boolean;
  status: RestaurantWhatsappStatus;
  wahaStatus: WahaSessionStatus | null;
  phoneNumber: string | null;
  displayName: string | null;
  needsQr: boolean;
  /** Session abgelaufen / FAILED — Nutzer soll „Erneut verbinden“ nutzen. */
  needsReconnect?: boolean;
  message?: string;
};

export type WahaQrResponse = {
  mimetype: string;
  data: string;
};

export type WahaPairingCodeResponse = {
  code: string;
};

export type RestaurantFacebookStatus = "disconnected" | "working";

export type FacebookConnectResponse = {
  platformEnabled: boolean;
  platformConfigured: boolean;
  configured: boolean;
  status: RestaurantFacebookStatus;
  pageName: string | null;
  pageId: string | null;
  connectedAt: string | null;
  message?: string;
};
