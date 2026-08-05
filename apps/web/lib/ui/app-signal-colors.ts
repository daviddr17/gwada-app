/**
 * Einheitliche Signal-Farben für Dashboard, Kalender, Reservierungen usw.
 * Nicht pro Modul neu erfinden — gleiche Bedeutung = gleiche Farbe.
 */
export const APP_SIGNAL_COLORS = {
  /** Gast-Reservierungen / primäre Auslastung */
  reservations: "var(--accent)",
  /** Veranstaltungen (private_event) */
  events: "#7c3aed",
  /** Schichtplan / geplante Mitarbeiter */
  staff: "#64748b",
  /** Geplante News-/Social-Posts */
  news: "#059669",
  /** Gesetzliche Feiertage */
  holiday: "#d97706",
  /** Sonderöffnungszeiten (offen) */
  hoursOpen: "#ea580c",
  /** Sonderöffnungszeiten (geschlossen) */
  hoursClosed: "#dc2626",
  /** Aufmerksamkeit / unbestätigt */
  attention: "#2563eb",
  /** Positiv / erledigt */
  success: "#059669",
  /** Warnung */
  warning: "#d97706",
} as const;

export type AppSignalColorKey = keyof typeof APP_SIGNAL_COLORS;
