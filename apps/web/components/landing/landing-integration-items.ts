import type { ComponentType } from "react";
import { FacebookGlyph } from "@/components/icons/facebook-glyph";
import { GoogleGlyph } from "@/components/icons/google-glyph";
import { InstagramGlyph } from "@/components/icons/instagram-glyph";
import { LexofficeGlyph } from "@/components/icons/lexoffice-glyph";
import { WhatsAppGlyph } from "@/components/icons/whatsapp-glyph";

export type LandingIntegrationId =
  | "google"
  | "facebook"
  | "instagram"
  | "whatsapp"
  | "lexoffice";

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
};

export const LANDING_INTEGRATION_ITEMS: LandingIntegrationItem[] = [
  {
    id: "google",
    title: "Google Business",
    description:
      "Profil, Bewertungen und lokale Sichtbarkeit — angebunden, damit Gäste euch dort finden, wo sie suchen.",
    Glyph: GoogleGlyph,
    accent: "from-blue-500/25 via-sky-500/10 to-transparent",
    brandGlow: "bg-blue-500/25",
  },
  {
    id: "facebook",
    title: "Facebook",
    description:
      "Seite und Messenger in einem Fluss — Nachrichten und Anfragen landen zentral bei eurem Team.",
    Glyph: FacebookGlyph,
    accent: "from-blue-600/20 via-indigo-500/10 to-transparent",
    brandGlow: "bg-blue-600/25",
  },
  {
    id: "instagram",
    title: "Instagram",
    description:
      "Direktnachrichten und Social-Kontakt — ohne Tab-Hopping, mit Kontext zum Gast im Dashboard.",
    Glyph: InstagramGlyph,
    accent: "from-fuchsia-500/20 via-orange-500/10 to-transparent",
    brandGlow: "bg-gradient-to-br from-orange-500/20 to-fuchsia-500/25",
  },
  {
    id: "whatsapp",
    title: "WhatsApp",
    description:
      "Die Nummer eures Hauses per QR oder Pairing — Gäste schreiben, ihr antwortet aus Gwada heraus.",
    Glyph: WhatsAppGlyph,
    accent: "from-emerald-500/25 via-teal-500/10 to-transparent",
    brandGlow: "bg-emerald-500/25",
  },
  {
    id: "lexoffice",
    title: "Lexware Office",
    description:
      "Rechnungen, Angebote und Belege — synchron mit Lexware Office für eure Buchführung und Kontakte.",
    Glyph: LexofficeGlyph,
    accent: "from-teal-500/25 via-emerald-500/10 to-transparent",
    brandGlow: "bg-[#00A88F]/25",
  },
];
