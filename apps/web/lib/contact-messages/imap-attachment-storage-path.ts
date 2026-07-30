/** Virtueller storage_path: Bytes liegen nicht im Bucket, Abruf per IMAP-Proxy. */
export const IMAP_ATTACHMENT_STORAGE_PREFIX = "imap:";

export function imapAttachmentStoragePath(uid: number, index: number): string {
  return `${IMAP_ATTACHMENT_STORAGE_PREFIX}${uid}:${index}`;
}

export function parseImapAttachmentStoragePath(
  storagePath: string | null | undefined,
): { uid: number; index: number } | null {
  const raw = storagePath?.trim() ?? "";
  if (!raw.startsWith(IMAP_ATTACHMENT_STORAGE_PREFIX)) return null;
  const rest = raw.slice(IMAP_ATTACHMENT_STORAGE_PREFIX.length);
  const m = /^(\d+):(\d+)$/.exec(rest);
  if (!m) return null;
  const uid = Number.parseInt(m[1], 10);
  const index = Number.parseInt(m[2], 10);
  if (!Number.isFinite(uid) || !Number.isFinite(index)) return null;
  return { uid, index };
}

export function isImapAttachmentStoragePath(
  storagePath: string | null | undefined,
): boolean {
  return parseImapAttachmentStoragePath(storagePath) != null;
}
