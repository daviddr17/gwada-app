/**
 * Sichtbarer Inbox-Thread: der Klick gewinnt vor der noch alten `?contact=`-URL.
 * Soft-Nav setzt den Query erst danach — ohne diese Reihenfolge bleibt Header + Filter
 * auf Chat A, während Cache/State schon Chat B sind.
 */
export function resolveInboxOverlayThreadId(args: {
  pendingContactId: string | null;
  contactParam: string | null;
  closingThreadId: string | null;
}): string | null {
  return args.pendingContactId ?? args.contactParam ?? args.closingThreadId;
}

/** Nachbarn in der aktuellen Liste — typische nächste Klicks wie bei WhatsApp. */
export function inboxNeighborContactIds(
  conversations: readonly { contact_id: string }[],
  selectedId: string | null | undefined,
): string[] {
  if (!selectedId) return [];
  const idx = conversations.findIndex((c) => c.contact_id === selectedId);
  if (idx < 0) return [];
  const ids: string[] = [];
  const prev = conversations[idx - 1];
  const next = conversations[idx + 1];
  if (prev) ids.push(prev.contact_id);
  if (next) ids.push(next.contact_id);
  return ids;
}
