/** Verfügbare Platzhalter in Musterverträgen — `{{gruppe.feld}}`. */

export type StaffContractPlaceholderDef = {
  token: string;
  label: string;
};

export const STAFF_CONTRACT_PLACEHOLDER_GROUPS: readonly {
  id: string;
  label: string;
  placeholders: readonly StaffContractPlaceholderDef[];
}[] = [
  {
    id: "mitarbeiter",
    label: "Mitarbeiter",
    placeholders: [
      { token: "{{mitarbeiter.vorname}}", label: "Vorname" },
      { token: "{{mitarbeiter.nachname}}", label: "Nachname" },
      { token: "{{mitarbeiter.name}}", label: "Vollständiger Name" },
      { token: "{{mitarbeiter.geburtsdatum}}", label: "Geburtsdatum" },
      { token: "{{mitarbeiter.nationalitaet}}", label: "Nationalität" },
      { token: "{{mitarbeiter.adresse}}", label: "Adresse" },
      { token: "{{mitarbeiter.plz}}", label: "PLZ" },
      { token: "{{mitarbeiter.ort}}", label: "Ort" },
      { token: "{{mitarbeiter.land}}", label: "Land" },
      { token: "{{mitarbeiter.email}}", label: "E-Mail" },
      { token: "{{mitarbeiter.telefon}}", label: "Telefon" },
      { token: "{{mitarbeiter.position}}", label: "Position" },
    ],
  },
  {
    id: "vertrag",
    label: "Vertrag",
    placeholders: [
      { token: "{{vertrag.beginn}}", label: "Beginn" },
      { token: "{{vertrag.ende}}", label: "Ende" },
      { token: "{{vertrag.verguetung}}", label: "Vergütung (formatiert)" },
      { token: "{{vertrag.stundenlohn}}", label: "Stundenlohn" },
      { token: "{{vertrag.festgehalt}}", label: "Festgehalt" },
      { token: "{{vertrag.urlaubstage}}", label: "Urlaubstage/Jahr" },
      { token: "{{vertrag.wochenstunden}}", label: "Soll-Wochenstunden" },
      { token: "{{vertrag.beschaeftigungsverhaeltnis}}", label: "Beschäftigungsverhältnis" },
    ],
  },
  {
    id: "restaurant",
    label: "Arbeitgeber",
    placeholders: [
      { token: "{{restaurant.name}}", label: "Anzeigename" },
      { token: "{{restaurant.firma}}", label: "Rechtlicher Name / Firma" },
      { token: "{{restaurant.vertreten_durch}}", label: "Vertreten durch" },
      { token: "{{restaurant.rechtsform}}", label: "Rechtsform" },
      { token: "{{restaurant.handelsregister}}", label: "Handelsregister" },
      { token: "{{restaurant.strasse}}", label: "Straße" },
      { token: "{{restaurant.plz}}", label: "PLZ" },
      { token: "{{restaurant.ort}}", label: "Ort" },
      { token: "{{restaurant.land}}", label: "Land" },
      { token: "{{restaurant.telefon}}", label: "Telefon" },
      { token: "{{restaurant.ust_id}}", label: "USt-IdNr." },
    ],
  },
] as const;
