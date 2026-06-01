import type { Metadata } from "next";
import { MarketingStaticPage } from "@/components/landing/marketing-static-page";

export const dynamic = "force-static";

export const metadata: Metadata = {
  description: "Datenschutzhinweise gemäß DSGVO.",
};

export default function DatenschutzPage() {
  return (
    <MarketingStaticPage title="Datenschutz">
      <p>
        Informationen zur Verarbeitung personenbezogener Daten gemäß DSGVO
        folgen in Kürze.
      </p>
    </MarketingStaticPage>
  );
}
