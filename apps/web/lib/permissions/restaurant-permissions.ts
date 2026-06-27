/** Berechtigungsschlüssel pro Restaurant-Position (in DB `restaurant_position_permissions`). */

import {
  MODULE_CRUD_LABELS,
  MODULE_CRUD_PREFIXES,
  type ModuleCrudOperation,
} from "@/lib/permissions/module-crud-permissions";

const MODULE_CRUD_OPS: ModuleCrudOperation[] = [
  "read",
  "create",
  "update",
  "delete",
];

const MODULE_CRUD_KEYS = MODULE_CRUD_PREFIXES.flatMap((prefix) =>
  MODULE_CRUD_OPS.map((op) => `${prefix}.${op}` as const),
);

/** Legacy — weiterhin in DB, nicht mehr in der UI. */
const LEGACY_MODULE_MANAGE_KEYS = MODULE_CRUD_PREFIXES.map(
  (prefix) => `${prefix}.manage` as const,
);

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
  ...MODULE_CRUD_KEYS,
  ...LEGACY_MODULE_MANAGE_KEYS,
  "gallery.read",
  "gallery.create",
  "gallery.update",
  "gallery.delete",
  "documents.notes.edit",
  "display.manage",
  "display.time",
  "display.time_presence",
  "display.reservations",
  "display.recipes",
  "display.inventory",
  "display.compliance",
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
    | "module"
    | "einstellungen"
    | "integrationen"
    | "dokumente"
    | "buchfuehrung"
    | "display"
    | "pos";
};

const MODULE_CRUD_DESCRIPTIONS: Record<
  ModuleCrudOperation,
  (moduleLabel: string) => string
> = {
  read: (m) => `${m} einsehen.`,
  create: (m) => `Neue Einträge in ${m} anlegen.`,
  update: (m) => `Bestehende Einträge in ${m} bearbeiten.`,
  delete: (m) => `Einträge in ${m} löschen.`,
};

function moduleCrudCatalogEntries(): RestaurantPermissionMeta[] {
  const out: RestaurantPermissionMeta[] = [];
  for (const prefix of MODULE_CRUD_PREFIXES) {
    const labels = MODULE_CRUD_LABELS[prefix];
    const group = prefix === "accounting" ? "buchfuehrung" : "module";
    for (const op of MODULE_CRUD_OPS) {
      const labelKey = op as keyof typeof labels;
      out.push({
        key: `${prefix}.${op}` as RestaurantPermissionKey,
        label: labels[labelKey],
        description: MODULE_CRUD_DESCRIPTIONS[op](labels.module),
        group,
      });
    }
  }
  return out;
}

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
    ...moduleCrudCatalogEntries(),
    {
      key: "gallery.read",
      label: "Galerie: Ansehen",
      description: "Bilder und Highlights in der Galerie einsehen.",
      group: "module",
    },
    {
      key: "gallery.create",
      label: "Galerie: Anlegen",
      description: "Neue Bilder und Highlights hochladen.",
      group: "module",
    },
    {
      key: "gallery.update",
      label: "Galerie: Bearbeiten",
      description: "Bilder, Kategorien und Highlights ändern.",
      group: "module",
    },
    {
      key: "gallery.delete",
      label: "Galerie: Löschen",
      description: "Bilder und Highlights entfernen.",
      group: "module",
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
      key: "display.compliance",
      label: "Display: Eigenkontrolle",
      description:
        "HACCP-Checklisten am Tablet erfassen — Temperatur, Reinigung u. a.",
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
  ...RESTAURANT_PERMISSION_CATALOG.map((e) => e.key),
  ...LEGACY_MODULE_MANAGE_KEYS.filter(
    (k) => !RESTAURANT_PERMISSION_CATALOG.some((e) => e.key === k),
  ),
];
