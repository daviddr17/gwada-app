import type { Metadata } from "next";
import { preload } from "react-dom";
import { LandingPage } from "@/components/landing/landing-page";
import { getCachedRootLayoutBranding } from "@/lib/platform/cached-layout-branding";
import { platformMarketingLogoHref } from "@/lib/platform/platform-marketing-logo-url";

export const metadata: Metadata = {
  description:
    "Speisekarte, Reservierungen, Team und Kanäle — ein System für den ganzen Betrieb. Free: 1 Login, Basic: 3, Pro unbegrenzt.",
};

export default async function Home() {
  const branding = await getCachedRootLayoutBranding();
  const heroLogo = platformMarketingLogoHref(branding, "light");
  if (heroLogo) {
    try {
      preload(heroLogo, { as: "image", fetchPriority: "high" });
    } catch {
      // Preload darf die Startseite nicht crashen (Logo-API / Optimizer).
    }
  }

  return (
    <div className="min-h-dvh">
      <LandingPage />
    </div>
  );
}
