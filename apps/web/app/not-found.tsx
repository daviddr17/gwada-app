import { MarketingCriticalCss } from "@/components/marketing/marketing-critical-css";
import { GwadaNotFoundScreen } from "@/components/not-found/gwada-not-found-screen";
import { MarketingProviders } from "@/components/providers/marketing-providers";
import { getCachedRootLayoutBranding } from "@/lib/platform/cached-layout-branding";
import { getCachedSidebarModuleOrder } from "@/lib/platform/cached-sidebar-module-order";
import { platformFaviconHref } from "@/lib/platform/branding-asset-url";
import "./marketing-surface.css";

export default async function NotFound() {
  const [branding, sidebarModuleOrder] = await Promise.all([
    getCachedRootLayoutBranding(),
    getCachedSidebarModuleOrder(),
  ]);
  const faviconHref = platformFaviconHref(branding.faviconPath);

  return (
    <>
      <MarketingCriticalCss />
      <MarketingProviders
        serverFaviconHref={faviconHref}
        initialBranding={branding}
        initialSidebarModuleOrder={sidebarModuleOrder}
      >
        <GwadaNotFoundScreen />
      </MarketingProviders>
    </>
  );
}
