/** PostgREST / Postgres errors when migrations are not applied yet. */
export function isMissingSchemaError(message: string | null | undefined): boolean {
  if (!message) return false;
  return (
    /does not exist/i.test(message) ||
    /could not find the '[^']+' column/i.test(message) ||
    /schema cache/i.test(message) ||
    /relation "public\./i.test(message)
  );
}
