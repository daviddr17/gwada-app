/** Trenner zwischen Kunden- und Superadmin-Teil in `body` (eine DB-Zeile). */
export const CHANGELOG_SUPERADMIN_SECTION_MARKER = "---superadmin---";

function stripNestedSuperadminMarker(superadminBody: string): string {
  const nestedIdx = superadminBody.indexOf(CHANGELOG_SUPERADMIN_SECTION_MARKER);
  if (nestedIdx === -1) return superadminBody;
  // Legacy: body wurde doppelt per joinChangelogBody zusammengefügt.
  return superadminBody.slice(0, nestedIdx).trim();
}

export function parseChangelogBody(body: string): {
  customerBody: string;
  superadminBody: string;
} {
  const normalized = body.replace(/\r\n/g, "\n");
  const idx = normalized.indexOf(CHANGELOG_SUPERADMIN_SECTION_MARKER);
  if (idx === -1) {
    return { customerBody: normalized.trim(), superadminBody: "" };
  }
  return {
    customerBody: normalized.slice(0, idx).trim(),
    superadminBody: stripNestedSuperadminMarker(
      normalized.slice(idx + CHANGELOG_SUPERADMIN_SECTION_MARKER.length).trim(),
    ),
  };
}

export function joinChangelogBody(
  customerBody: string,
  superadminBody: string,
): string {
  const customer = customerBody.trim();
  const superadmin = superadminBody.trim();
  if (!superadmin) return customer;
  if (!customer) {
    return `${CHANGELOG_SUPERADMIN_SECTION_MARKER}\n${superadmin}`;
  }
  return `${customer}\n${CHANGELOG_SUPERADMIN_SECTION_MARKER}\n${superadmin}`;
}
