import type { Metadata } from "next";
import Link from "next/link";
import { MarketingStaticPage } from "@/components/landing/marketing-static-page";
import {
  PLATFORM_OPERATOR,
  platformOperatorAddressLines,
} from "@/lib/legal/platform-operator";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "AGB",
  description: `Allgemeine Geschäftsbedingungen für ${PLATFORM_OPERATOR.productName}.`,
};

export default function AgbPage() {
  const o = PLATFORM_OPERATOR;

  return (
    <MarketingStaticPage
      title="Allgemeine Geschäftsbedingungen"
      description={`Nutzungsbedingungen für die SaaS-Plattform ${o.productName}.`}
      updatedLabel={o.documentsUpdatedLabel}
      activePath="/agb"
    >
      <h2>§ 1 Geltungsbereich und Anbieter</h2>
      <p>
        Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für die Nutzung der
        Software-as-a-Service-Plattform {o.productName} unter {o.productUrl}{" "}
        zwischen
      </p>
      <address className="space-y-0.5">
        {platformOperatorAddressLines().map((line) => (
          <div key={line}>{line}</div>
        ))}
      </address>
      <p>
        (nachfolgend „Anbieter“) und dem jeweiligen Kunden (nachfolgend
        „Kunde“). Entgegenstehende oder abweichende Bedingungen des Kunden
        gelten nicht, es sei denn, der Anbieter stimmt ihnen ausdrücklich
        schriftlich zu.
      </p>

      <h2>§ 2 Vertragsgegenstand</h2>
      <p>
        Der Anbieter stellt dem Kunden eine browserbasierte Plattform zur
        digitalen Organisation von Restaurant-Prozessen bereit (u. a.
        Speisekarte, Reservierungen, Betrieb, Kommunikation, optional POS und
        Integrationen). Funktionsumfang richtet sich nach dem gebuchten Plan
        bzw. Add-on und der jeweils aktuellen Leistungsbeschreibung auf der
        Website bzw. in der App.
      </p>
      <p>
        Der Anbieter ist berechtigt, den Dienst weiterzuentwickeln, Funktionen
        anzupassen oder einzustellen, sofern die wesentlichen
        Vertragsleistungen nicht unzumutbar beeinträchtigt werden.
      </p>

      <h2>§ 3 Registrierung und Vertragsschluss</h2>
      <p>
        Die Nutzung erfordert ein Nutzerkonto und in der Regel die Anlage
        eines Restaurant-Workspaces. Mit Registrierung bzw. Bestätigung eines
        kostenpflichtigen Abos gibt der Kunde ein verbindliches Angebot ab. Der
        Vertrag kommt mit Freischaltung des Accounts bzw. Annahme der Bestellung
        (auch durch Bereitstellung) zustande.
      </p>
      <p>
        Der Kunde sichert zu, wahrheitsgemäße Angaben zu machen und Zugangsdaten
        geheim zu halten. Handlungen unter seinem Account gelten als ihm
        zurechenbar, soweit er nicht nachweist, dass ein Missbrauch ohne sein
        Verschulden vorlag.
      </p>

      <h2>§ 4 Pläne, Preise, Zahlung</h2>
      <p>
        Es gelten die auf der Website ausgewiesenen Preise (brutto bzw. netto
        wie angegeben) für Free-, Basic-, Pro-Pläne und optionale Add-ons
        (z. B. POS). Abrechnung erfolgt über den Zahlungsdienstleister Stripe
        im gewählten Intervall (monatlich/jährlich), sofern nicht anders
        vereinbart.
      </p>
      <p>
        Der Anbieter kann Preise mit angemessener Ankündigung für künftige
        Zeiträume ändern. Bei Nichtzahlung kann der Zugang zu
        kostenpflichtigen Funktionen eingeschränkt werden.
      </p>

      <h2>§ 5 Pflichten des Kunden</h2>
      <ul>
        <li>
          Der Kunde nutzt den Dienst nur rechtmäßig und stellt sicher, dass
          eigene Inhalte (Texte, Bilder, Gästedaten, Nachrichten) keine Rechte
          Dritter verletzen und den gesetzlichen Vorgaben entsprechen
          (insbesondere Datenschutz, Telemedien, Lebensmittelkennzeichnung,
          Kassensicherungsverordnung soweit einschlägig).
        </li>
        <li>
          Der Kunde ist Verantwortlicher für personenbezogene Daten seiner
          Gäste und Mitarbeiter, die er in {o.productName} verarbeitet. Der
          Auftragsverarbeitungsvertrag (
          <Link href="/avv">AVV</Link>) ist Bestandteil bei
          Auftragsverarbeitung.
        </li>
        <li>
          Der Kunde hält Integrationen (Meta, Google, WhatsApp, E-Mail,
          Fiskalisierung usw.) gemäß den Bedingungen der Drittanbieter und
          geltendem Recht.
        </li>
        <li>
          Missbrauch, Scraping, Überlastung oder Umgehen von
          Zugriffsbeschränkungen sind untersagt.
        </li>
      </ul>

      <h2>§ 6 Verfügbarkeit und Support</h2>
      <p>
        Der Anbieter strebt eine hohe Verfügbarkeit an, schuldet jedoch keine
        ununterbrochene Verfügbarkeit. Wartungsfenster und Störungen von
        Drittanbietern (Hosting, Meta, WhatsApp-Gateway, Stripe usw.) können
        die Nutzung beeinträchtigen. Support erfolgt je nach Plan (z. B.
        Community, E-Mail, priorisiert) in zumutbarer Frist.
      </p>

      <h2>§ 7 Nutzungsrechte an Inhalten</h2>
      <p>
        Inhalte, die der Kunde einstellt, verbleiben beim Kunden bzw. den
        jeweiligen Rechteinhabern. Der Kunde räumt dem Anbieter ein einfaches,
        zeitlich auf die Vertragslaufzeit beschränktes Recht ein, diese Inhalte
        zur Erbringung des Dienstes zu hosten, zu verarbeiten und technisch
        darzustellen. Öffentliche Seiten/Einbettungen erfolgen nur, soweit der
        Kunde sie freigibt.
      </p>

      <h2>§ 8 Datenschutz</h2>
      <p>
        Informationen zur Verarbeitung personenbezogener Daten enthält die{" "}
        <Link href="/datenschutz">Datenschutzerklärung</Link>. Für die
        Verarbeitung von Kundendaten im Auftrag gilt der{" "}
        <Link href="/avv">AVV</Link>.
      </p>

      <h2>§ 9 Haftung</h2>
      <p>
        Der Anbieter haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit,
        bei Verletzung von Leben, Körper oder Gesundheit sowie nach dem
        Produkthaftungsgesetz. Bei leichter Fahrlässigkeit haftet der Anbieter
        nur bei Verletzung wesentlicher Vertragspflichten (Kardinalpflichten)
        und begrenzt auf den vorhersehbaren, vertragstypischen Schaden. Die
        Haftung für entgangenen Gewinn, mittelbare Schäden und Datenverlust ist
        — soweit gesetzlich zulässig — ausgeschlossen, sofern der Kunde keine
        angemessenen eigenen Sicherungskopien seiner exportierbaren Daten
        vorhält.
      </p>
      <p>
        Der Anbieter haftet nicht für Inhalte und Rechtsverstöße des Kunden
        oder seiner Endkunden/Gäste sowie nicht für Ausfälle von Drittsystemen
        außerhalb seines Einflussbereichs.
      </p>

      <h2>§ 10 Laufzeit und Kündigung</h2>
      <p>
        Free-Zugänge können vom Anbieter oder Kunden jederzeit beendet werden.
        Kostenpflichtige Abos verlängern sich automatisch um die gewählte
        Periode, sofern nicht rechtzeitig gekündigt wird. Kündigung ist über
        die in der App bereitgestellten Wege (z. B. Kundenportal) oder in
        Textform möglich. Das Recht zur außerordentlichen Kündigung aus
        wichtigem Grund bleibt unberührt.
      </p>
      <p>
        Nach Vertragsende kann der Anbieter Daten gemäß Datenschutzerklärung und
        AVV löschen. Der Kunde ist für rechtzeitige Exporte selbst
        verantwortlich.
      </p>

      <h2>§ 11 Änderungen der AGB</h2>
      <p>
        Der Anbieter kann diese AGB mit Wirkung für die Zukunft ändern, wenn
        dies aus rechtlichen, technischen oder wirtschaftlichen Gründen
        erforderlich ist. Über wesentliche Änderungen wird der Kunde
        angemessen informiert. Widerspricht der Kunde nicht innerhalb einer
        angemessenen Frist oder nutzt er den Dienst weiter, gelten die neuen
        AGB als akzeptiert — hierauf wird in der Information hingewiesen.
      </p>

      <h2>§ 12 Schlussbestimmungen</h2>
      <p>
        Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des
        UN-Kaufrechts. Gerichtsstand für Kaufleute ist — soweit zulässig —
        der Sitz des Anbieters. Sollten einzelne Bestimmungen unwirksam sein,
        bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.
      </p>

      <p>
        <Link href="/impressum">Impressum</Link>
        {" · "}
        <Link href="/datenschutz">Datenschutz</Link>
        {" · "}
        <Link href="/avv">AVV</Link>
      </p>
    </MarketingStaticPage>
  );
}
