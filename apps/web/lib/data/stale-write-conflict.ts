export const STALE_WRITE_CONFLICT_CODE = "stale_write";

export const STALE_WRITE_CONFLICT_MESSAGE =
  "Diese Daten wurden zwischenzeitlich geändert. Bitte neu laden.";

export function staleWriteConflictError(): Error {
  const error = new Error(STALE_WRITE_CONFLICT_MESSAGE);
  error.name = "StaleWriteConflictError";
  return error;
}

export function isStaleWriteConflict(
  error: Error | null | undefined,
): boolean {
  if (!error) return false;
  return (
    error.name === "StaleWriteConflictError" ||
    error.message === STALE_WRITE_CONFLICT_MESSAGE
  );
}

export type WriteConflictCheck = {
  expectedUpdatedAt?: string | null;
};

/** After a filtered update returned no row: missing vs concurrent overwrite. */
export async function resolveMissingUpdateConflict(params: {
  expectedUpdatedAt?: string | null;
  exists: () => Promise<boolean>;
}): Promise<Error> {
  if (!params.expectedUpdatedAt) {
    return new Error("Datensatz nicht gefunden.");
  }
  const exists = await params.exists();
  return exists
    ? staleWriteConflictError()
    : new Error("Datensatz nicht gefunden.");
}
