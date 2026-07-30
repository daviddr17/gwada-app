import type { Metadata } from "next";
import Link from "next/link";
import { MarketingStaticPage } from "@/components/landing/marketing-static-page";
import { PLATFORM_OPERATOR } from "@/lib/legal/platform-operator";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Datenlöschung",
  description: `Anleitung zur Löschung von Konto- und Meta-verbundenen Daten bei ${PLATFORM_OPERATOR.productName}.`,
};

export default function DatenloeschungPage() {
  const o = PLATFORM_OPERATOR;

  return (
    <MarketingStaticPage
      title="Datenlöschung"
      description="Anleitung zur Löschung Ihres Gwada-Kontos sowie von über Meta (Facebook / Instagram) verbundenen Daten — u. a. für die Meta App Review."
      updatedLabel={o.documentsUpdatedLabel}
      activePath="/datenloeschung"
    >
      <h2>1. Gwada-Konto und Restaurant-Workspace löschen</h2>
      <ol>
        <li>
          Melden Sie sich unter{" "}
          <a href={o.productUrl}>{o.productUrl.replace(/^https?:\/\//, "")}</a>{" "}
          an.
        </li>
        <li>
          Exportieren Sie benötigte Daten (soweit in der App verfügbar), bevor
          Sie löschen.
        </li>
        <li>
          Beenden Sie ggf. ein kostenpflichtiges Abo über die
          Abo-/Stripe-Verwaltung in den Einstellungen.
        </li>
        <li>
          Beantragen Sie die Löschung Ihres Kontos bzw. Workspaces per E-Mail
          an{" "}
          <a href={`mailto:${o.privacyEmail}?subject=Löschanfrage%20Gwada`}>
            {o.privacyEmail}
          </a>{" "}
          mit der Betreffzeile „Löschanfrage Gwada“ und Angabe der
          Account-E-Mail sowie des betroffenen Restaurants.
        </li>
      </ol>
      <p>
        Wir bestätigen den Eingang und löschen bzw. anonymisieren die Daten
        innerhalb der gesetzlichen und vertraglichen Fristen, sofern keine
        Aufbewahrungspflichten entgegenstehen (siehe{" "}
        <Link href="/datenschutz">Datenschutzerklärung</Link> und{" "}
        <Link href="/avv">AVV</Link>).
      </p>

      <h2>2. Meta-Verbindung (Facebook / Instagram) trennen</h2>
      <ol>
        <li>
          In {o.productName}: Integrationen / verbundene Social-Kanäle öffnen
          und die Verbindung zu Facebook bzw. Instagram trennen (sofern
          verbunden).
        </li>
        <li>
          Zusätzlich in den Meta-Einstellungen Ihres Facebook-Kontos unter
          „Einstellungen & Datenschutz“ → „Einstellungen“ → „Apps und
          Websites“ die App „{o.productName}“ entfernen bzw. Berechtigungen
          widerrufen.
        </li>
      </ol>
      <p>
        Nach dem Trennen verarbeiten wir keine neuen Daten mehr über die
        Meta-APIs für diesen Account. Bereits synchronisierte Inhalte im
        Restaurant-Workspace können vom Workspace-Owner gelöscht oder über die
        Löschanfrage (Abschnitt 1) mitbeantragt werden.
      </p>

      <h2>3. Datenlöschungs-Callback (Meta)</h2>
      <p>
        Wenn Meta eine automatisierte Datenlöschungsanfrage an uns übermittelt
        (Data Deletion Request Callback), verarbeiten wir diese Anfrage und
        entfernen die mit der Meta-User-ID verknüpften Verbindungs- und
        Sync-Daten in {o.productName}. Eine Bestätigung bzw. Status-URL wird —
        soweit von Meta vorgesehen — bereitgestellt.
      </p>
      <p>
        Manuelle Anfragen erreichen uns jederzeit unter{" "}
        <a href={`mailto:${o.privacyEmail}`}>{o.privacyEmail}</a>.
      </p>

      <h2>4. WhatsApp / andere Kanäle</h2>
      <p>
        Für WhatsApp-Sessions und sonstige Integrationen beenden Sie die
        Verbindung in den jeweiligen Moduleinstellungen oder fordern die
        Löschung wie in Abschnitt 1 an. Externe Anbieter (Meta, Google, Stripe
        usw.) können eigene Löschwege vorsehen.
      </p>

      <p>
        <Link href="/datenschutz">Datenschutzerklärung</Link>
        {" · "}
        <Link href="/impressum">Impressum</Link>
        {" · "}
        <Link href="/agb">AGB</Link>
      </p>
    </MarketingStaticPage>
  );
}
