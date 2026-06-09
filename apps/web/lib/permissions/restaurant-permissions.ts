/** Berechtigungsschlüssel pro Restaurant-Position (in DB `restaurant_position_permissions`). */

export const RESTAURANT_PERMISSION_KEYS = [
  "roles.manage",
  "team.manage",
  "integrations.whatsapp",
  "integrations.email",
  "integrations.facebook",
  "integrations.instagram",
  "integrations.google_business",
  "integrations.lexoffice",
  "settings.restaurant",
  "settings.opening_hours",
  "settings.branding",
  "settings.dashboard",
  "documents.notes.edit",
  "display.manage",
  "display.time",
  "display.time_presence",
  "display.reservations",
  "display.recipes",
  "display.inventory",
  "display.kds",
  "display.module_switch",
  "pos.kasse.manage",
  "pos.kasse.export",
] as const;

export type RestaurantPermissionKey =
  (typeof RESTAURANT_PERMISSION_KEYS)[number];

export type RestaurantPermissionMeta = {
  key: RestaurantPermissionKey;
  label: string;
  description: string;
  group:
    | "administration"
    | "einstellungen"
    | "integrationen"
    | "dokumente"
    | "display"
    | "pos";
};

export const RESTAURANT_PERMISSION_CATALOG: readonly RestaurantPermissionMeta[] =
  [
    {
      key: "roles.manage",
      label: "Rollen verwalten",
      description: "Positionen anlegen und Berechtigungen festlegen.",
      group: "administration",
    },
    {
      key: "team.manage",
      label: "Team verwalten",
      description: "Mitglieder einladen, Position zuweisen, aktivieren.",
      group: "administration",
    },
    {
      key: "integrations.whatsapp",
      label: "WhatsApp verbinden",
      description: "WAHA-Session starten, QR-Code / Pairing-Code.",
      group: "integrationen",
    },
    {
      key: "integrations.email",
      label: "E-Mail-Absender",
      description: "Eigene Absender-Adresse für Reservierungs-Mails (SMTP).",
      group: "integrationen",
    },
    {
      key: "integrations.facebook",
      label: "Facebook / Messenger",
      description: "Facebook-Seite für Messenger-Nachrichten verbinden.",
      group: "integrationen",
    },
    {
      key: "integrations.instagram",
      label: "Instagram",
      description: "Instagram Business über Meta verbinden.",
      group: "integrationen",
    },
    {
      key: "integrations.google_business",
      label: "Google Business Profile",
      description: "Unternehmensprofil bei Google verknüpfen.",
      group: "integrationen",
    },
    {
      key: "integrations.lexoffice",
      label: "Lexware Office",
      description: "Lexware Office (Lexoffice) per API-Key verbinden.",
      group: "integrationen",
    },
    {
      key: "settings.restaurant",
      label: "Restaurant-Stammdaten",
      description: "Name, Adresse, Kontakt.",
      group: "einstellungen",
    },
    {
      key: "settings.opening_hours",
      label: "Öffnungszeiten",
      description: "Wochenplan und Ausnahmen.",
      group: "einstellungen",
    },
    {
      key: "settings.branding",
      label: "Branding",
      description: "Akzentfarbe und Erscheinungsbild.",
      group: "einstellungen",
    },
    {
      key: "settings.dashboard",
      label: "Dashboard-Widgets",
      description: "Sichtbare Kacheln im Dashboard.",
      group: "einstellungen",
    },
    {
      key: "documents.notes.edit",
      label: "Dokument-Notizen bearbeiten",
      description:
        "Bestehende protokollierte Notizen ändern; ohne diese Berechtigung nur hinzufügen.",
      group: "dokumente",
    },
    {
      key: "display.manage",
      label: "Displays verwalten",
      description: "Tablets koppeln, Module und Auto-Lock festlegen.",
      group: "display",
    },
    {
      key: "display.time",
      label: "Display: Zeiterfassung",
      description: "Schicht starten, Pause und Schicht beenden am Tablet.",
      group: "display",
    },
    {
      key: "display.time_presence",
      label: "Display: Team-Anwesenheit",
      description:
        "Im Display-Modul Zeiterfassung sehen, wer gerade eingestempelt ist oder in Pause.",
      group: "display",
    },
    {
      key: "display.reservations",
      label: "Display: Reservierungen",
      description: "Reservierungen am Tablet einsehen und bearbeiten.",
      group: "display",
    },
    {
      key: "display.recipes",
      label: "Display: Rezepte",
      description: "Gerichte und Rezepte am Tablet ansehen.",
      group: "display",
    },
    {
      key: "display.inventory",
      label: "Display: Bestand & Bestellung",
      description:
        "Bestand erfassen und Bestellmengen am Tablet eingeben (Touch-Inventur).",
      group: "display",
    },
    {
      key: "display.kds",
      label: "Display: Bestellungen (KDS)",
      description: "Küchen-Display für Bestellungen (folgt).",
      group: "display",
    },
    {
      key: "display.module_switch",
      label: "Display: Modulwechsel",
      description: "Zwischen erlaubten Display-Modulen wechseln.",
      group: "display",
    },
    {
      key: "pos.kasse.manage",
      label: "Kasse öffnen und schließen",
      description: "Kassenöffnung mit Anfangsbestand und Z-Bon-Abschluss.",
      group: "pos",
    },
    {
      key: "pos.kasse.export",
      label: "Kassenberichte und DSFinV-K",
      description: "X-/Z-Berichte als PDF und DSFinV-K-Export (ZIP).",
      group: "pos",
    },
  ] as const;

/** Alle Keys — für System-Position „Inhaber“. */
export const ALL_RESTAURANT_PERMISSION_KEYS: RestaurantPermissionKey[] = [
  ...RESTAURANT_PERMISSION_KEYS,
];
