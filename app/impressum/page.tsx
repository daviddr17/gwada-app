import type { Metadata } from "next";
import { MarketingStaticPage } from "@/components/landing/marketing-static-page";

export const dynamic = "force-static";

export const metadata: Metadata = {
  description: "Impressum und Anbieterkennzeichnung.",
};

export default function ImpressumPage() {
  return (
    <MarketingStaticPage title="Impressum">
      <p>Angaben gemäß § 5 TMG folgen in Kürze.</p>
    </MarketingStaticPage>
  );
}
