import type { Metadata } from "next";
import Link from "next/link";
import { DocsCallout } from "@/components/docs/docs-callout";
import { DocsProse } from "@/components/docs/docs-prose";
import { USER_GUIDE_PAGES } from "@/lib/docs/user-guide-content";

export const metadata: Metadata = {
  title: "Erste Schritte",
  description: "Einstieg in gwada — Anmeldung, Restaurants und Grundlagen.",
};

export default function DocsErsteSchrittePage() {
  return (
    <DocsProse
      title="Erste Schritte"
      description="So startest du mit gwada — von der Anmeldung bis zum ersten Modul."
    >
      <p>
        gwada bündelt Speisekarte, Reservierungen, Team, Nachrichten und mehr in
        einer Plattform für Restaurants. Diese Anleitung richtet sich an alle
        Nutzer — Inhaber, Manager und Mitarbeiter.
      </p>

      <DocsCallout variant="note" title="Keine Screenshots">
        Die Dokumentation ist bewusst textbasiert. Menübezeichnungen entsprechen
        der App — so findest du alles auch nach Updates wieder, ohne veraltete
        Bilder vergleichen zu müssen.
      </DocsCallout>

      <h2>1. Anmelden</h2>
      <ol>
        <li>
          Öffne <Link href="/login">gwada.app/login</Link>.
        </li>
        <li>Melde dich mit E-Mail und Passwort an.</li>
        <li>
          Wurdest du eingeladen, nutze den Link aus der Einladungs-E-Mail — er
          führt dich direkt ins richtige Restaurant.
        </li>
      </ol>

      <h2>2. Restaurant wählen</h2>
      <p>
        Hast du Zugriff auf mehrere Betriebe, wählst du oben rechts über{" "}
        <strong>Meine Restaurants</strong> das aktive Restaurant. Alle Module beziehen
        sich immer auf dieses Restaurant.
      </p>

      <h2>3. Dashboard erkunden</h2>
      <p>
        Nach dem Login landest du auf dem <Link href="/docs/handbuch/dashboard">Dashboard</Link>.
        Hier siehst du Widgets mit Tagesinformationen. Über die Sidebar links erreichst
        du alle Module — Speisekarte, Reservierungen, Mitarbeiter und weitere.
      </p>

      <h2>4. Berechtigungen</h2>
      <p>
        Nicht jeder sieht alle Module. Dein Team-Admin legt unter{" "}
        <Link href="/docs/handbuch/einstellungen">Einstellungen → Team → Rollen</Link>{" "}
        fest, wer was darf. Fehlt ein Modul in der Sidebar, brauchst du mehr Rechte
        — sprich mit deinem Administrator.
      </p>

      <h2>5. Nächste Schritte</h2>
      <ul>
        <li>
          <Link href="/docs/navigation">Navigation verstehen</Link> — Sidebar, Tabs,
          Schnellaktionen
        </li>
        <li>
          <Link href="/docs/handbuch/einstellungen">Restaurant einrichten</Link> —
          Name, Öffnungszeiten, Integrationen
        </li>
        <li>
          <Link href="/docs/handbuch/oeffentliches-profil">Profil veröffentlichen</Link>{" "}
          — damit Gäste dich online finden
        </li>
      </ul>

      <h2>Alle Module im Überblick</h2>
      <ul>
        {USER_GUIDE_PAGES.map((page) => (
          <li key={page.slug}>
            <Link href={`/docs/handbuch/${page.slug}`}>{page.title}</Link> —{" "}
            {page.description}
          </li>
        ))}
      </ul>
    </DocsProse>
  );
}
