import type { Metadata } from "next";
import { MarketingStaticPage } from "@/components/landing/marketing-static-page";

export const dynamic = "force-static";

export const metadata: Metadata = {
  description: "Dokumentation und Guides für gwada.",
};

export default function DocsPage() {
  return (
    <MarketingStaticPage title="Dokumentation">
      <p>
        API-Hinweise, Datenmodell und Best Practices folgen hier als lebendige
        Guides. Bis dahin: einloggen und im Dashboard ausprobieren.
      </p>
    </MarketingStaticPage>
  );
}
