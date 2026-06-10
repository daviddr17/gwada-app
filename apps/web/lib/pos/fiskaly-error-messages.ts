/** Maps raw Fiskaly / provision errors to German UI labels. */

const CODE_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  {
    pattern: /E_CLIENT_CONFLICT/i,
    label:
      "Client-ID existiert bereits bei Fiskaly — bitte „Abgleichen“ nutzen.",
  },
  {
    pattern: /E_ILLEGAL_CLIENT_SERIAL/i,
    label:
      "Serien-Nr. ist bei Fiskaly bereits vergeben — „Abgleichen“ oder im Fiskaly-Dashboard prüfen.",
  },
  {
    pattern: /E_TSS_CONFLICT/i,
    label: "TSS-ID existiert bereits — Provision mit gespeicherten IDs fortsetzen.",
  },
  {
    pattern: /E_TSS_NOT_FOUND/i,
    label: "TSS bei Fiskaly nicht gefunden — erneut anlegen oder Abgleich.",
  },
  {
    pattern: /E_CLIENT_NOT_FOUND/i,
    label: "Client bei Fiskaly nicht gefunden — erneut anlegen oder Abgleich.",
  },
  {
    pattern: /fiskaly_not_configured/i,
    label: "Fiskaly ist nicht konfiguriert (API-Key/Secret fehlt).",
  },
  {
    pattern: /restaurant_not_found/i,
    label: "Restaurant nicht gefunden.",
  },
];

export function germanFiskalyProvisionError(raw: string | null | undefined): string {
  const message = raw?.trim();
  if (!message) return "Unbekannter Fehler";

  for (const { pattern, label } of CODE_PATTERNS) {
    if (pattern.test(message)) return label;
  }

  if (message.includes("DSFinV-K")) {
    return message.replace(/^DSFinV-K cash register:\s*/i, "DSFinV-K Kasse: ");
  }

  return message.length > 240 ? `${message.slice(0, 240)}…` : message;
}

export function suggestsFiskalyReconcile(raw: string | null | undefined): boolean {
  const message = raw?.trim() ?? "";
  return (
    /E_ILLEGAL_CLIENT_SERIAL/i.test(message) ||
    /E_CLIENT_CONFLICT/i.test(message) ||
    /serial/i.test(message)
  );
}

export function fiskalyProvisionOutcomeLabel(
  outcome: string,
  opts?: { dsfinvkBackfillOnly?: boolean },
): string {
  switch (outcome) {
    case "created":
      return "Neu bei Fiskaly angelegt";
    case "skipped_ready":
      return opts?.dsfinvkBackfillOnly
        ? "Bereit (DSFinV-K nachgezogen)"
        : "Bereits bereit (übersprungen)";
    case "linked_existing":
      return "Mit bestehendem Fiskaly-Standort verknüpft";
    case "dsfinvk_backfill":
      return "DSFinV-K Kasse nachgezogen";
    case "failed":
      return "Fehlgeschlagen";
    default:
      return outcome;
  }
}
