/** Öffentliches Embed / Gäste-Widget — große Gruppen nur über Staff. */
export const RESERVATION_PARTY_SIZE_MAX_PUBLIC = 30;

/**
 * Dashboard, Display, POS, Voice — inkl. große Gruppen / Events.
 * DB-Check muss dazu passen (`reservations.party_size`).
 */
export const RESERVATION_PARTY_SIZE_MAX_STAFF = 200;

export function isValidPublicPartySize(n: number): boolean {
  return Number.isFinite(n) && n >= 1 && n <= RESERVATION_PARTY_SIZE_MAX_PUBLIC;
}

export function isValidStaffPartySize(n: number): boolean {
  return Number.isFinite(n) && n >= 1 && n <= RESERVATION_PARTY_SIZE_MAX_STAFF;
}
