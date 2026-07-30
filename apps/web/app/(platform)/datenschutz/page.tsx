import type { Metadata } from "next";
import Link from "next/link";
import { MarketingStaticPage } from "@/components/landing/marketing-static-page";
import {
  PLATFORM_OPERATOR,
  platformOperatorAddressLines,
} from "@/lib/legal/platform-operator";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Datenschutz",
  description: `Datenschutzerklärung für ${PLATFORM_OPERATOR.productName} gemäß DSGVO.`,
};

export default function DatenschutzPage() {
  const o = PLATFORM_OPERATOR;

  return (
    <MarketingStaticPage
      title="Datenschutzerklärung"
      description={`Informationen zur Verarbeitung personenbezogener Daten bei Nutzung von ${o.productName} (${o.productUrl}).`}
      updatedLabel={o.documentsUpdatedLabel}
      activePath="/datenschutz"
    >
      <h2>1. Verantwortlicher</h2>
      <p>
        Verantwortlicher im Sinne der Datenschutz-Grundverordnung (DSGVO) für die
        Plattform {o.productName} ist:
      </p>
      <address className="space-y-0.5">
        {platformOperatorAddressLines().map((line) => (
          <div key={line}>{line}</div>
        ))}
        <div>
          E-Mail:{" "}
          <a href={`mailto:${o.privacyEmail}`}>{o.privacyEmail}</a>
        </div>
      </address>
      <p>
        Soweit Restaurants (unsere Kunden) über {o.productName} Gästedaten
        verarbeiten, handeln sie in der Regel selbst als Verantwortliche für
        diese Daten. Wir stellen die technische Plattform bereit und verarbeiten
        solche Daten als Auftragsverarbeiter gemäß Art. 28 DSGVO — siehe{" "}
        <Link href="/avv">AVV</Link>.
      </p>

      <h2>2. Überblick: Welche Daten wir verarbeiten</h2>
      <ul>
        <li>
          <strong>Website-Besucher:</strong> technische Verbindungsdaten beim
          Aufruf von {o.productUrl}
        </li>
        <li>
          <strong>Accounts / Workspace:</strong> Registrierungs- und
          Profildaten, Restaurant-Stammdaten, Nutzungs- und Logdaten
        </li>
        <li>
          <strong>Kundeninhalte:</strong> Speisekarten, Reservierungen,
          Mitarbeiterdaten, Nachrichten, Medien — die das Restaurant in der App
          speichert
        </li>
        <li>
          <strong>Abrechnung:</strong> Abo-, Zahlungs- und Rechnungsdaten über
          unseren Zahlungsdienstleister
        </li>
        <li>
          <strong>Integrationen:</strong> Daten, die über verbundene Dienste
          (z. B. E-Mail, Google, Meta, WhatsApp-Gateway, Kasse) fließen
        </li>
      </ul>

      <h2>3. Website und Marketing-Seiten</h2>
      <h3>3.1 Server-Logfiles</h3>
      <p>
        Beim Aufruf unserer Website werden technisch erforderliche Daten
        verarbeitet (z. B. IP-Adresse, Zeitpunkt, angeforderte Ressource,
        User-Agent). Zweck: Bereitstellung, Sicherheit und Stabilität des
        Dienstes. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes
        Interesse an einem sicheren Betrieb). Speicherdauer: so kurz wie für
        Betrieb und Sicherheit erforderlich, danach Löschung oder Anonymisierung.
      </p>
      <h3>3.2 Cookies / lokale Speicherung</h3>
      <p>
        Wir setzen technisch notwendige Cookies bzw. lokale Speicherungen ein
        (z. B. Session, Theme, Sprachwahl). Soweit wir optionale Analyse- oder
        Marketing-Cookies einsetzen, erfolgt dies nur mit Ihrer Einwilligung
        (Art. 6 Abs. 1 lit. a DSGVO). Sie können Cookies in Ihrem Browser
        einschränken; notwendige Funktionen können dann eingeschränkt sein.
      </p>
      <h3>3.3 Kontakt / Warteliste</h3>
      <p>
        Wenn Sie uns über Formulare kontaktieren oder sich für die Warteliste
        eintragen, verarbeiten wir die von Ihnen angegebenen Daten zur
        Bearbeitung der Anfrage bzw. zur Information über den Produktstart.
        Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (vorvertraglich) bzw. lit. f
        (Kommunikation) oder lit. a bei Newsletter-Opt-in.
      </p>

      <h2>4. Plattform-Accounts und Restaurant-Workspaces</h2>
      <p>
        Für die Nutzung von {o.productName} verarbeiten wir insbesondere:
      </p>
      <ul>
        <li>E-Mail-Adresse, Name, Telefon (sofern angegeben), Profilbilder</li>
        <li>Authentifizierungs- und Session-Daten</li>
        <li>
          Restaurant-Stammdaten (Name, Adresse, Öffnungszeiten, Branding,
          Einstellungen)
        </li>
        <li>
          Rollen/Mitgliedschaften im Team, Einladungen, Aktivitätszeiten
          (z. B. zuletzt gesehen)
        </li>
        <li>
          Inhalte, die Sie oder Ihr Team in Modulen anlegen (z. B. Speisekarte,
          Reservierungen, Dokumente, Nachrichten)
        </li>
      </ul>
      <p>
        Rechtsgrundlagen: Art. 6 Abs. 1 lit. b DSGVO (Vertrag über die
        Plattformnutzung), lit. f (Sicherheit, Missbrauchsprävention,
        Produktverbesserung in aggregierter Form), lit. c soweit gesetzliche
        Aufbewahrungspflichten bestehen.
      </p>

      <h2>5. Zahlungen und Abonnements</h2>
      <p>
        Abonnements und Zahlungen werden über <strong>Stripe</strong>{" "}
        abgewickelt. Dabei werden Zahlungsdaten direkt an Stripe übermittelt;
        wir speichern in der Regel keine vollständigen Kartendaten. Stripe
        verarbeitet Daten als eigener Verantwortlicher bzw. als unser
        Auftragsverarbeiter je nach Verarbeitungsschritt. Details:{" "}
        <a
          href="https://stripe.com/privacy"
          rel="noopener noreferrer"
          target="_blank"
        >
          stripe.com/privacy
        </a>
        . Rechtsgrundlage: Art. 6 Abs. 1 lit. b und lit. c DSGVO.
      </p>

      <h2>6. Hosting und Infrastruktur</h2>
      <p>
        Wir hosten die Anwendung und Datenbanken auf von uns beauftragten
        Infrastruktur-Anbietern (u. a. Server-Hosting / Supabase-kompatible
        Postgres-Umgebung in der EU oder mit geeigneten Garantien).
        Zugriffsprotokolle und Backups dienen Betrieb und Wiederherstellung.
        Rechtsgrundlage: Art. 6 Abs. 1 lit. b und lit. f DSGVO.
      </p>

      <h2>7. Integrationen und Unterauftragsverarbeiter</h2>
      <p>
        Je nach Aktivierung durch das Restaurant können Daten an folgende
        Kategorien von Diensten fließen:
      </p>
      <ul>
        <li>
          <strong>E-Mail-Versand</strong> (Plattform-SMTP und/oder
          restaurant-eigene SMTP/OAuth-Postfächer)
        </li>
        <li>
          <strong>Google</strong> (z. B. Google Business Profile OAuth)
        </li>
        <li>
          <strong>Meta</strong> (Facebook / Instagram Graph API, Webhooks)
        </li>
        <li>
          <strong>WhatsApp-Gateway (WAHA)</strong> — Session-/Nachrichtenverkehr
          über von uns betriebene bzw. zugewiesene WAHA-Server
        </li>
        <li>
          <strong>TripAdvisor</strong> und weitere Bewertungs-/Content-Kanäle
        </li>
        <li>
          <strong>Lexware Office / Buchhaltungsexporte</strong>
        </li>
        <li>
          <strong>Fiskaly / TSE</strong> im Rahmen des optionalen POS-Add-ons
        </li>
        <li>
          <strong>Karten / Wetter / sonstige Hilfsdienste</strong>, soweit in
          Integrationen freigeschaltet
        </li>
      </ul>
      <p>
        Rechtsgrundlage gegenüber Endnutzern der Restaurant-Kanäle liegt
        typischerweise beim Restaurant (Verantwortlicher). Unsere Verarbeitung
        für Kunden erfolgt auf Basis des Nutzungsvertrags und des{" "}
        <Link href="/avv">AVV</Link>. Bei Meta-/Google-Login bzw. App-Verbindung
        gelten zusätzlich die Bedingungen und Datenschutzhinweise der jeweiligen
        Anbieter.
      </p>

      <h2>8. Meta (Facebook / Instagram)</h2>
      <p>
        Wenn Sie Meta-Produkte mit {o.productName} verbinden, erhalten wir über
        die Meta-APIs die für die jeweilige Funktion erforderlichen Daten
        (z. B. Seiten-IDs, Nachrichten-Metadaten, Media, Insights — abhängig von
        erteilten Berechtigungen). Zweck: Anbindung der Social-/Messaging-Module
        für Ihr Restaurant. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO
        (Vertragsdurchführung) bzw. lit. a, soweit Einwilligungen erforderlich
        sind.
      </p>
      <p>
        Hinweise zur Löschung von über Meta verbundenen Daten:{" "}
        <Link href="/datenloeschung">Datenlöschung</Link>.
      </p>

      <h2>9. Speicherdauer</h2>
      <p>
        Wir speichern personenbezogene Daten nur so lange, wie es für die
        genannten Zwecke erforderlich ist oder gesetzliche
        Aufbewahrungsfristen (z. B. handels-/steuerrechtlich) bestehen. Nach
        Vertragsende löschen oder anonymisieren wir Account- und
        Workspace-Daten innerhalb angemessener Fristen, sofern keine
        Aufbewahrungspflichten entgegenstehen. Backups werden zeitlich begrenzt
        vorgehalten und rollierend überschrieben.
      </p>

      <h2>10. Empfänger und Drittlandtransfers</h2>
      <p>
        Eine Weitergabe erfolgt an Auftragsverarbeiter und — soweit nötig —
        an Behörden. Bei Übermittlungen in Drittländer (z. B. USA bei
        US-Anbietern) setzen wir geeignete Garantien ein (insbesondere
        EU-Standardvertragsklauseln) bzw. stützen uns auf Angemessenheitsbeschlüsse
        oder Ihre Einwilligung, soweit gesetzlich vorgesehen.
      </p>

      <h2>11. Ihre Rechte</h2>
      <p>Sie haben — soweit die gesetzlichen Voraussetzungen vorliegen — das Recht auf:</p>
      <ul>
        <li>Auskunft (Art. 15 DSGVO)</li>
        <li>Berichtigung (Art. 16 DSGVO)</li>
        <li>Löschung (Art. 17 DSGVO)</li>
        <li>Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
        <li>Datenübertragbarkeit (Art. 20 DSGVO)</li>
        <li>Widerspruch gegen Verarbeitungen auf Basis von Art. 6 Abs. 1 lit. f (Art. 21 DSGVO)</li>
        <li>Widerruf erteilter Einwilligungen (Art. 7 Abs. 3 DSGVO)</li>
      </ul>
      <p>
        Zur Ausübung wenden Sie sich an{" "}
        <a href={`mailto:${o.privacyEmail}`}>{o.privacyEmail}</a>. Zudem besteht
        ein Beschwerderecht bei einer Datenschutzaufsichtsbehörde.
      </p>

      <h2>12. Sicherheit</h2>
      <p>
        Wir treffen angemessene technische und organisatorische Maßnahmen
        (Zugangskontrolle, Verschlüsselung in Transit, rollenbasierte
        Berechtigungen, Protokollierung sicherheitsrelevanter Ereignisse).
        Absolute Sicherheit kann nicht garantiert werden.
      </p>

      <h2>13. Pflicht zur Bereitstellung</h2>
      <p>
        Ohne die für Vertrag und Account erforderlichen Daten (insbesondere
        E-Mail und Authentifizierung) können wir {o.productName} nicht
        bereitstellen.
      </p>

      <h2>14. Automatisierte Entscheidungen</h2>
      <p>
        Es findet keine automatisierte Entscheidungsfindung einschließlich
        Profiling mit Rechtswirkung im Sinne von Art. 22 DSGVO statt.
      </p>

      <h2>15. Änderungen</h2>
      <p>
        Wir passen diese Erklärung an, wenn sich Dienste, Rechtslage oder
        Verarbeitungen ändern. Es gilt die jeweils auf dieser Seite
        veröffentlichte Fassung (Stand oben).
      </p>

      <h2>16. Weitere Dokumente</h2>
      <p>
        <Link href="/impressum">Impressum</Link>
        {" · "}
        <Link href="/agb">AGB</Link>
        {" · "}
        <Link href="/avv">AVV</Link>
        {" · "}
        <Link href="/datenloeschung">Datenlöschung</Link>
      </p>
    </MarketingStaticPage>
  );
}
