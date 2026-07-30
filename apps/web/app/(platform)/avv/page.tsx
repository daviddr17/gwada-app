import type { Metadata } from "next";
import Link from "next/link";
import { MarketingStaticPage } from "@/components/landing/marketing-static-page";
import {
  PLATFORM_OPERATOR,
  platformOperatorAddressLines,
} from "@/lib/legal/platform-operator";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "AVV",
  description: `Auftragsverarbeitungsvertrag (Art. 28 DSGVO) für ${PLATFORM_OPERATOR.productName}.`,
};

export default function AvvPage() {
  const o = PLATFORM_OPERATOR;

  return (
    <MarketingStaticPage
      title="Auftragsverarbeitungsvertrag (AVV)"
      description="Vereinbarung gemäß Art. 28 DSGVO zwischen dem Restaurant-Kunden (Verantwortlicher) und dem Anbieter von Gwada (Auftragsverarbeiter)."
      updatedLabel={o.documentsUpdatedLabel}
      activePath="/avv"
    >
      <p>
        Dieser AVV gilt automatisch mit Nutzung von {o.productName}, soweit der
        Kunde personenbezogene Daten in der Plattform verarbeiten lässt, für die
        er Verantwortlicher ist. Er ergänzt die{" "}
        <Link href="/agb">AGB</Link> und die{" "}
        <Link href="/datenschutz">Datenschutzerklärung</Link>.
      </p>

      <h2>1. Parteien</h2>
      <p>
        <strong>Verantwortlicher:</strong> der jeweilige Kunde / das Restaurant,
        das {o.productName} nutzt.
      </p>
      <p>
        <strong>Auftragsverarbeiter:</strong>
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

      <h2>2. Gegenstand und Dauer</h2>
      <p>
        Gegenstand ist die Verarbeitung personenbezogener Daten im Rahmen der
        Bereitstellung von {o.productName} (Hosting, Speicherung, Übertragung,
        Anzeige, Backup, Support). Die Dauer entspricht der Laufzeit des
        Nutzungsvertrags zuzüglich gesetzlicher bzw. vereinbarter
        Aufbewahrungs- und Löschfristen.
      </p>

      <h2>3. Art und Zweck der Verarbeitung</h2>
      <p>Zweck: technische Bereitstellung der Restaurant-Software inkl. Module
        (u. a. Speisekarte, Reservierungen, Kontakte/Nachrichten, Mitarbeiter,
        Dokumente, Bewertungen, optional POS und Drittintegrationen).</p>
      <p>
        Art: Erheben, Speichern, Auslesen, Übermitteln, Löschen —
        weisungsgebunden nach dokumentierter Nutzung durch den Verantwortlichen.
      </p>

      <h2>4. Art der personenbezogenen Daten</h2>
      <ul>
        <li>Stammdaten von Mitarbeitern und Team-Accounts</li>
        <li>
          Gästedaten (z. B. Name, Kontakt, Reservierungsdetails, Nachrichten)
        </li>
        <li>Inhalte aus Modulen (Dokumente, Medien, Protokolle)</li>
        <li>
          Technische Metadaten (IPs in Logs, Geräte-/Session-Informationen)
        </li>
        <li>
          Bei Integrationen: kanalbezogene Identifikatoren und Nachrichteninhalte
        </li>
      </ul>

      <h2>5. Kategorien betroffener Personen</h2>
      <ul>
        <li>Mitarbeiter und beauftragte Nutzer des Verantwortlichen</li>
        <li>Gäste / Endkunden des Verantwortlichen</li>
        <li>Sonstige Kontaktpersonen in Nachrichten- und Bewertungskanälen</li>
      </ul>

      <h2>6. Pflichten des Auftragsverarbeiters</h2>
      <ul>
        <li>
          Verarbeitung nur auf dokumentierte Weisung des Verantwortlichen
          (Nutzung der Plattform und Support-Anfragen), es sei denn, eine
          gesetzliche Pflicht besteht
        </li>
        <li>
          Verpflichtung zur Vertraulichkeit der zur Verarbeitung befugten
          Personen
        </li>
        <li>
          Ergreifen geeigneter technischer und organisatorischer Maßnahmen
          gemäß Art. 32 DSGVO
        </li>
        <li>
          Unterstützung des Verantwortlichen bei Betroffenenanfragen und bei
          Datenschutz-Folgenabschätzungen im zumutbaren Umfang
        </li>
        <li>
          Information bei Verletzungen des Schutzes personenbezogener Daten
          ohne unangemessene Verzögerung
        </li>
        <li>
          Nach Ende der Verarbeitung: Löschung oder Rückgabe der
          personenbezogenen Daten nach Wahl des Verantwortlichen, soweit keine
          Aufbewahrungspflicht besteht
        </li>
      </ul>

      <h2>7. Pflichten des Verantwortlichen</h2>
      <ul>
        <li>
          Sicherstellung einer rechtmäßigen Verarbeitung und der erforderlichen
          Rechtsgrundlagen gegenüber Betroffenen
        </li>
        <li>
          Korrekte Konfiguration von Freigaben, Rollen und Integrationen
        </li>
        <li>
          Erteilung von Weisungen in der durch die Plattform vorgesehenen Form
        </li>
      </ul>

      <h2>8. Unterauftragsverarbeiter</h2>
      <p>
        Der Verantwortliche genehmigt die Beauftragung von
        Unterauftragsverarbeitern in folgenden Kategorien, soweit für den
        Betrieb erforderlich:
      </p>
      <ul>
        <li>Hosting / Datenbank / Objektspeicher</li>
        <li>E-Mail-Zustellung</li>
        <li>Zahlungsabwicklung (Stripe)</li>
        <li>WhatsApp-/Messaging-Gateway (WAHA-Infrastruktur)</li>
        <li>Optional: Meta, Google, TripAdvisor, Fiskaly, Lexware und ähnliche
          Integrationen — nur bei Aktivierung durch den Verantwortlichen</li>
      </ul>
      <p>
        Der Auftragsverarbeiter verpflichtet Unterauftragsverarbeiter
        datenschutzrechtlich angemessen und informiert über wesentliche
        Änderungen der eingesetzten Unterauftragsverarbeiter in zumutbarer Weise
        (z. B. Aktualisierung dieser Seite oder Mitteilung in der App). Der
        Verantwortliche kann aus wichtigem datenschutzrechtlichen Grund
        widersprechen; in dem Fall kann die weitere Nutzung betroffener
        Funktionen eingeschränkt sein.
      </p>

      <h2>9. Internationale Datenübermittlung</h2>
      <p>
        Soweit Unterauftragsverarbeiter Daten außerhalb der EU/EWR verarbeiten,
        stellt der Auftragsverarbeiter geeignete Garantien sicher (insbesondere
        Standardvertragsklauseln) oder stützt sich auf sonstige zulässige
        Transfermechanismen.
      </p>

      <h2>10. Kontrollrechte</h2>
      <p>
        Der Verantwortliche kann die Einhaltung der in diesem AVV niedergelegten
        Pflichten in angemessenem Umfang prüfen lassen (z. B. durch Auskünfte,
        aktuelle TOM-Beschreibungen oder — nach Vorankündigung und unter
        Wahrung von Betriebsgeheimnissen — Audits). Audits dürfen den Betrieb
        nicht unverhältnismäßig beeinträchtigen.
      </p>

      <h2>11. Weisungen</h2>
      <p>
        Weisungen erfolgen über die Nutzung der Plattformfunktionen sowie per
        E-Mail an <a href={`mailto:${o.privacyEmail}`}>{o.privacyEmail}</a>.
        Offensichtlich rechtswidrige Weisungen wird der Auftragsverarbeiter
        hinweisen.
      </p>

      <h2>12. Schlussbestimmungen</h2>
      <p>
        Es gilt das Recht der Bundesrepublik Deutschland. Sollten Bestimmungen
        unwirksam sein, bleibt der Vertrag im Übrigen wirksam. Bei
        Widersprüchen zwischen AGB und diesem AVV gehen die datenschutzrechtlichen
        Regelungen dieses AVV vor.
      </p>

      <p>
        <Link href="/impressum">Impressum</Link>
        {" · "}
        <Link href="/datenschutz">Datenschutz</Link>
        {" · "}
        <Link href="/agb">AGB</Link>
      </p>
    </MarketingStaticPage>
  );
}
