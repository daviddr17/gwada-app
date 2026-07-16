/** Kurzes „Ja“ / Bestätigen für Sprach-Nachfrage-Sheets. */
export function isVoiceConfirmUtterance(text: string): boolean {
  const t = text
    .trim()
    .toLowerCase()
    .replace(/[.!?,;:]+$/g, "")
    .replace(/\s+/g, " ");
  if (!t || t.length > 48) return false;
  if (/\b(nein|nicht|abbrechen|stopp|stop|abbruch)\b/.test(t)) return false;

  const exact = new Set([
    "ja",
    "ja bitte",
    "jap",
    "jo",
    "yes",
    "yep",
    "ok",
    "okay",
    "passt",
    "stimmt",
    "korrekt",
    "richtig",
    "anlegen",
    "bitte anlegen",
    "ja anlegen",
    "setzen",
    "bitte setzen",
    "hinzufügen",
    "hinzufuegen",
    "bitte hinzufügen",
    "bitte hinzufuegen",
    "bestätigen",
    "bestaetigen",
    "bestätige",
    "bestaetige",
    "machen",
    "los",
  ]);
  if (exact.has(t)) return true;

  if (/^(ja|jap|jo|yes|yep|ok|okay)\b/.test(t)) return true;
  if (/^(bitte\s+)?(anlegen|setzen|hinzufügen|hinzufuegen)\b/.test(t)) {
    return true;
  }
  if (/^bestätige?n?\b/.test(t) || /^bestaetige?n?\b/.test(t)) return true;
  return false;
}
