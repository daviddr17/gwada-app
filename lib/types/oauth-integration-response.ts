export type OAuthIntegrationStatusResponse = {
  platformEnabled: boolean;
  platformConfigured: boolean;
  configured: boolean;
  status: "disconnected" | "working";
  displayName: string | null;
  accountId: string | null;
  secondaryLabel: string | null;
  connectedAt: string | null;
  requestedScopes: string[];
  grantedScopes: string[];
  message?: string;
};
