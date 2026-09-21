/** Sync-Fehler, die nach Token-Refresh oder erneutem Verbinden sofort wieder versucht werden dürfen. */
export function isGoogleCredentialSyncError(
  error: string | null | undefined,
): boolean {
  const text = error?.trim() ?? "";
  if (!text) return false;
  return /invalid authentication credentials|unauthenticated|invalid_grant|authError|google_token_missing/i.test(
    text,
  );
}
