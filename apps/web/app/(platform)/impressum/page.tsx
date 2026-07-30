import type { Metadata } from "next";
import Link from "next/link";
import { MarketingStaticPage } from "@/components/landing/marketing-static-page";
import {
  PLATFORM_OPERATOR,
  platformOperatorAddressLines,
} from "@/lib/legal/platform-operator";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Impressum",
  description: `Impressum und Anbieterkennzeichnung für ${PLATFORM_OPERATOR.productName}.`,
};

export default function ImpressumPage() {
  const o = PLATFORM_OPERATOR;

  return (
    <MarketingStaticPage
      title="Impressum"
      description="Angaben gemäß § 5 DDG (ehemals TMG) und § 18 Abs. 2 MStV."
      updatedLabel={o.documentsUpdatedLabel}
      activePath="/impressum"
    >
      <h2>Anbieter</h2>
      <address className="space-y-0.5">
        {platformOperatorAddressLines().map((line) => (
          <div key={line}>{line}</div>
        ))}
      </address>

      <h2>Kontakt</h2>
      <ul>
        <li>
          E-Mail:{" "}
          <a href={`mailto:${o.contactEmail}`}>{o.contactEmail}</a>
        </li>
        <li>
          Website:{" "}
          <a href={o.productUrl} rel="noopener noreferrer">
            {o.productUrl.replace(/^https?:\/\//, "")}
          </a>
        </li>
        <li>
          Anbieter:{" "}
          <a href={o.operatorWebsite} rel="noopener noreferrer">
            {o.operatorWebsite.replace(/^https?:\/\//, "")}
          </a>
        </li>
      </ul>

      <h2>Vertretungsberechtigt</h2>
      <p>{o.ownerName}</p>

      {o.vatId ? (
        <>
          <h2>Umsatzsteuer</h2>
          <p>
            Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG:{" "}
            <strong>{o.vatId}</strong>
          </p>
        </>
      ) : (
        <>
          <h2>Umsatzsteuer</h2>
          <p>
            Eine Umsatzsteuer-Identifikationsnummer wird nach Erteilung hier
            veröffentlicht. Bis dahin gilt die gesetzliche Pflichtangabe erst
            nach Vorliegen der Nummer.
          </p>
        </>
      )}

      <h2>Verantwortlich für den Inhalt</h2>
      <p>
        Verantwortlich für journalistisch-redaktionelle Inhalte gemäß § 18 Abs. 2
        MStV: {o.ownerName}, Anschrift wie oben.
      </p>

      <h2>EU-Streitschlichtung</h2>
      <p>
        Die Europäische Kommission stellt eine Plattform zur
        Online-Streitbeilegung (OS) bereit:{" "}
        <a
          href="https://ec.europa.eu/consumers/odr/"
          rel="noopener noreferrer"
          target="_blank"
        >
          https://ec.europa.eu/consumers/odr/
        </a>
        . Unsere E-Mail-Adresse finden Sie oben im Impressum.
      </p>
      <p>
        Wir sind nicht verpflichtet und nicht bereit, an
        Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle
        teilzunehmen.
      </p>

      <h2>Haftung für Inhalte und Links</h2>
      <p>
        Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte
        auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach
        §§ 8 bis 10 DDG sind wir als Diensteanbieter jedoch nicht verpflichtet,
        übermittelte oder gespeicherte fremde Informationen zu überwachen oder
        nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit
        hinweisen. Verpflichtungen zur Entfernung oder Sperrung der Nutzung von
        Informationen nach den allgemeinen Gesetzen bleiben hiervon unberührt.
      </p>
      <p>
        Unser Angebot enthält Links zu externen Websites Dritter, auf deren
        Inhalte wir keinen Einfluss haben. Für die Inhalte der verlinkten Seiten
        ist stets der jeweilige Anbieter verantwortlich.
      </p>

      <h2>Weitere Rechtstexte</h2>
      <p>
        <Link href="/datenschutz">Datenschutzerklärung</Link>
        {" · "}
        <Link href="/agb">Allgemeine Geschäftsbedingungen</Link>
        {" · "}
        <Link href="/avv">Auftragsverarbeitungsvertrag (AVV)</Link>
        {" · "}
        <Link href="/datenloeschung">Datenlöschung (Meta / Konto)</Link>
      </p>
    </MarketingStaticPage>
  );
}
