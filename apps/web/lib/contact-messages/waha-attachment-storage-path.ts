/** Virtueller storage_path: Bytes liegen bei WAHA, Abruf per Media-Proxy. */
export const WAHA_ATTACHMENT_STORAGE_PREFIX = "waha:";

export function wahaAttachmentStoragePath(
  chatId: string,
  messageId: string,
): string {
  return `${WAHA_ATTACHMENT_STORAGE_PREFIX}${chatId.trim()}:${messageId.trim()}`;
}

export function parseWahaAttachmentStoragePath(
  storagePath: string | null | undefined,
): { chatId: string; messageId: string } | null {
  const raw = storagePath?.trim() ?? "";
  if (!raw.startsWith(WAHA_ATTACHMENT_STORAGE_PREFIX)) return null;
  const rest = raw.slice(WAHA_ATTACHMENT_STORAGE_PREFIX.length);
  const sep = rest.indexOf(":");
  if (sep <= 0 || sep >= rest.length - 1) return null;
  const chatId = rest.slice(0, sep).trim();
  const messageId = rest.slice(sep + 1).trim();
  if (!chatId || !messageId) return null;
  return { chatId, messageId };
}

export function isWahaAttachmentStoragePath(
  storagePath: string | null | undefined,
): boolean {
  return parseWahaAttachmentStoragePath(storagePath) != null;
}
