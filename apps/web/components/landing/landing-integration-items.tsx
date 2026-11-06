import type { ComponentType } from "react";
import { CloudSun, Mail, Wallet } from "lucide-react";
import { FacebookGlyph } from "@/components/icons/facebook-glyph";
import { GoogleGlyph } from "@/components/icons/google-glyph";
import { InstagramGlyph } from "@/components/icons/instagram-glyph";
import { LexofficeGlyph } from "@/components/icons/lexoffice-glyph";
import { TripadvisorGlyph } from "@/components/icons/tripadvisor-glyph";
import { WhatsAppGlyph } from "@/components/icons/whatsapp-glyph";
import { cn } from "@/lib/utils";

export type LandingIntegrationId =
  | "google"
  | "facebook"
  | "instagram"
  | "whatsapp"
  | "email"
  | "lexoffice"
  | "tripadvisor"
  | "mollie"
  | "weather";

export type IntegrationGlyphProps = {
  className?: string;
  gradId?: string;
};

export type LandingIntegrationItem = {
  id: LandingIntegrationId;
  title: string;
  description: string;
  Glyph: ComponentType<IntegrationGlyphProps>;
  accent: string;
  /** Tailwind gradient für Brand-Glow */
  brandGlow: string;
  shortLabel: string;
};

function MailGlyph({ className }: IntegrationGlyphProps) {
  return <Mail className={cn("size-5 shrink-0 text-sky-600 dark:text-sky-400", className)} aria-hidden />;
}

function MollieGlyph({ className }: IntegrationGlyphProps) {
  return (
    <Wallet
      className={cn("size-5 shrink-0 text-[#0A2540] dark:text-[#7dd3fc]", className)}
      aria-hidden
    />
  );
}

function WeatherGlyph({ className }: IntegrationGlyphProps) {
  return (
    <CloudSun
      className={cn("size-5 shrink-0 text-amber-500 dark:text-amber-300", className)}
      aria-hidden
    />
  );
}

/** Tenant-/Produkt-Integrationen die live angebunden sind (kein Login-OAuth). */
export const LANDING_INTEGRATION_ITEMS: LandingIntegrationItem[] = [
  {
    id: "google",
    title: "Google Business",
    description:
      "Profil, Bewertungen und lokale Sichtbarkeit — angebunden, damit Gäste euch dort finden, wo sie suchen.",
    Glyph: GoogleGlyph,
    accent: "from-blue-500/25 via-sky-500/10 to-transparent",
    brandGlow: "bg-blue-500/25",
    shortLabel: "Google",
  },
  {
    id: "facebook",
    title: "Facebook",
    description:
      "Seite und Messenger in einem Fluss — Nachrichten und Anfragen landen zentral bei eurem Team.",
    Glyph: FacebookGlyph,
    accent: "from-blue-600/20 via-indigo-500/10 to-transparent",
    brandGlow: "bg-blue-600/25",
    shortLabel: "Facebook",
  },
  {
    id: "instagram",
    title: "Instagram",
    description:
      "Direktnachrichten und Social-Kontakt — ohne Tab-Hopping, mit Kontext zum Gast im Dashboard.",
    Glyph: InstagramGlyph,
    accent: "from-fuchsia-500/20 via-orange-500/10 to-transparent",
    brandGlow: "bg-gradient-to-br from-orange-500/20 to-fuchsia-500/25",
    shortLabel: "Instagram",
  },
  {
    id: "whatsapp",
    title: "WhatsApp",
    description:
      "Die Nummer eures Hauses per QR oder Pairing — Gäste schreiben, ihr antwortet aus Gwada heraus.",
    Glyph: WhatsAppGlyph,
    accent: "from-emerald-500/25 via-teal-500/10 to-transparent",
    brandGlow: "bg-emerald-500/25",
    shortLabel: "WhatsApp",
  },
  {
    id: "email",
    title: "E-Mail",
    description:
      "Postfach in Gwada — Gwada-Mail, eigener SMTP oder Gmail/Outlook, inkl. gemeinsamer Team-Mailbox.",
    Glyph: MailGlyph,
    accent: "from-sky-500/25 via-blue-500/10 to-transparent",
    brandGlow: "bg-sky-500/25",
    shortLabel: "E-Mail",
  },
  {
    id: "lexoffice",
    title: "Lexware Office",
    description:
      "Rechnungen, Angebote und Belege — synchron mit Lexware Office für eure Buchführung und Kontakte.",
    Glyph: LexofficeGlyph,
    accent: "from-teal-500/25 via-emerald-500/10 to-transparent",
    brandGlow: "bg-[#00A88F]/25",
    shortLabel: "Lexware",
  },
  {
    id: "tripadvisor",
    title: "TripAdvisor",
    description:
      "Bewertungen und Fotos im Blick — Location verknüpfen und Feedback neben Google auswerten.",
    Glyph: TripadvisorGlyph,
    accent: "from-emerald-400/25 via-teal-500/10 to-transparent",
    brandGlow: "bg-[#34E0A1]/25",
    shortLabel: "TripAdvisor",
  },
  {
    id: "mollie",
    title: "Mollie",
    description:
      "Zahlungen für Gäste und Terminals — eigenes Mollie-Konto verbinden, getrennt vom Gwada-Abo.",
    Glyph: MollieGlyph,
    accent: "from-indigo-500/20 via-sky-500/10 to-transparent",
    brandGlow: "bg-indigo-500/20",
    shortLabel: "Mollie",
  },
  {
    id: "weather",
    title: "Wetter",
    description:
      "Lokale Wetterdaten im Dashboard — für Planung, Schicht und Gäste-Kommunikation.",
    Glyph: WeatherGlyph,
    accent: "from-amber-400/25 via-sky-400/10 to-transparent",
    brandGlow: "bg-amber-400/25",
    shortLabel: "Wetter",
  },
];
