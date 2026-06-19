export const CLIENT_OUTBOUND_EXTERNAL_PREFIX = "client:";

export function clientOutboundExternalSourceId(clientSendId: string): string {
  return `${CLIENT_OUTBOUND_EXTERNAL_PREFIX}${clientSendId}`;
}

export function isClientOutboundExternalSourceId(
  externalSourceId: string | null | undefined,
): boolean {
  return externalSourceId?.startsWith(CLIENT_OUTBOUND_EXTERNAL_PREFIX) ?? false;
}
