const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PROFILE_ID_KEYS = [
  "createdByProfileId",
  "actorProfileId",
  "actorUserId",
  "created_by_profile_id",
  "actor_profile_id",
  "actor_user_id",
] as const;

/** Titel ohne Person — die Zeile bleibt „Beleg“, bis ein Name da ist. */
const GENERIC_ACCOUNTING_TITLES = new Set([
  "beleg",
  "rechnung",
  "angebot",
  "neuer beleg",
  "neue rechnung",
  "neues angebot",
]);

/** Platzhalter aus Profil-Sync und Inhaber-Fallback, kein Personenname. */
const PLACEHOLDER_NAMES = new Set(["user", "inhaber", "beleg", "empfänger"]);

export function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

export function asUuid(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim().toLowerCase();
  return UUID_RE.test(id) ? id : null;
}

/** Name für die Titelzeile. UUIDs, E-Mails und Platzhalter bleiben leer. */
export function usableUploaderName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.replace(/—/g, " ").replace(/\s+/g, " ").trim();
  if (!name) return null;
  if (UUID_RE.test(name)) return null;
  if (name.includes("@")) return null;
  if (PLACEHOLDER_NAMES.has(name.toLowerCase())) return null;
  return name;
}

export function personNameFromParts(
  given: string | null | undefined,
  family: string | null | undefined,
  extras?: Array<string | null | undefined>,
): string | null {
  const joined = [given, family]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(" ");
  for (const candidate of [joined, ...(extras ?? [])]) {
    const name = usableUploaderName(candidate);
    if (name) return name;
  }
  return null;
}

/** Profil-Id aus dem Event, wenn sie dort steht. */
export function accountingProfileIdFromPayload(
  payload: Record<string, unknown> | null | undefined,
): string | null {
  if (!payload) return null;
  for (const key of PROFILE_ID_KEYS) {
    const id = asUuid(payload[key]);
    if (id) return id;
  }
  return null;
}

export function isGenericAccountingFeedTitle(title: string): boolean {
  return GENERIC_ACCOUNTING_TITLES.has(title.trim().toLowerCase());
}

/**
 * Ein späterer Eintrag darf „Beleg“ durch „Vorname Nachname · Beleg“ ersetzen.
 * Ein Eintrag ohne Person darf einen schon gezeigten Namen nicht wieder löschen.
 */
export function preferAccountingFeedTitle(current: string, incoming: string): string {
  if (
    isGenericAccountingFeedTitle(current) &&
    !isGenericAccountingFeedTitle(incoming)
  ) {
    return incoming;
  }
  if (
    !isGenericAccountingFeedTitle(current) &&
    isGenericAccountingFeedTitle(incoming)
  ) {
    return current;
  }
  return incoming;
}

/** Erste Profil-Id, deren Name wirklich eine Person ist. */
export function firstNamedProfileId(
  candidates: ReadonlyArray<string | null | undefined>,
  namesByProfileId: ReadonlyMap<string, string>,
): string | null {
  for (const raw of candidates) {
    const id = asUuid(raw);
    if (!id) continue;
    if (usableUploaderName(namesByProfileId.get(id))) return id;
  }
  return null;
}

export function resolveAccountingUploaderName(input: {
  payload: Record<string, unknown>;
  profileId: string | null;
  namesByProfileId: ReadonlyMap<string, string>;
  logName?: string | null;
}): string | null {
  const fromPayload = usableUploaderName(input.payload.uploaderName);
  if (fromPayload) return fromPayload;
  const id = input.profileId ?? accountingProfileIdFromPayload(input.payload);
  if (id) {
    const known = usableUploaderName(input.namesByProfileId.get(id));
    if (known) return known;
  }
  return usableUploaderName(input.logName);
}
