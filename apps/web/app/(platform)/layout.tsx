import { AppProviders } from "@/components/providers/app-providers";
import { getCachedRootLayoutBranding } from "@/lib/platform/cached-layout-branding";
import { getCachedSidebarModuleOrder } from "@/lib/platform/cached-sidebar-module-order";
import { platformFaviconHref } from "@/lib/platform/branding-asset-url";

export default async function PlatformLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [branding, sidebarModuleOrder] = await Promise.all([
    getCachedRootLayoutBranding(),
    getCachedSidebarModuleOrder(),
  ]);
  const faviconHref = platformFaviconHref(branding.faviconPath);

  return (
    <AppProviders
      serverFaviconHref={faviconHref}
      initialBranding={branding}
      initialSidebarModuleOrder={sidebarModuleOrder}
    >
      {children}
    </AppProviders>
  );
}
