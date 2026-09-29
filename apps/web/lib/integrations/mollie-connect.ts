export const MOLLIE_AUTHORIZE_URL = "https://my.mollie.com/oauth2/authorize";

/** Enough to create payments later. No application-fee scopes. */
export const MOLLIE_CONNECT_SCOPES = [
  "payments.read",
  "payments.write",
  "organizations.read",
  "profiles.read",
] as const;

export const MOLLIE_PLATFORM_NOT_READY_MESSAGE =
  "Gwada kann euch noch nicht zu Mollie weiterleiten. Client-ID und Secret der Plattform-App fehlen noch. Es wird nichts abgebucht.";

export const MOLLIE_PLATFORM_DISABLED_MESSAGE =
  "Mollie ist noch nicht freigeschaltet. Es wird nichts abgebucht.";

export type MollieConnectionSecrets = {
  status: string;
  organization_name: string | null;
  organization_id: string | null;
  profile_id: string | null;
  access_token: string | null;
  refresh_token: string | null;
  connected_at: string | null;
};

export type PublicPaymentAccountConnection = {
  status: "connected" | "disconnected";
  displayName: string | null;
  connectedAt: string | null;
};

export function buildMollieAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const q = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    state: params.state,
    scope: MOLLIE_CONNECT_SCOPES.join(" "),
    response_type: "code",
    approval_prompt: "auto",
  });
  return `${MOLLIE_AUTHORIZE_URL}?${q.toString()}`;
}

/** Name only. Tokens and Mollie ids stay on the server. */
export function publicMollieConnection(
  row: MollieConnectionSecrets | null,
): PublicPaymentAccountConnection {
  const connected =
    row?.status === "connected" && Boolean(row.access_token?.trim());
  if (!connected || !row) {
    return { status: "disconnected", displayName: null, connectedAt: null };
  }
  return {
    status: "connected",
    displayName: row.organization_name,
    connectedAt: row.connected_at,
  };
}
