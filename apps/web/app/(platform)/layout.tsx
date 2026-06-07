import { AppProviders } from "@/components/providers/app-providers";
import { getCachedRootLayoutBranding } from "@/lib/platform/cached-layout-branding";
import { platformFaviconHref } from "@/lib/platform/branding-asset-url";

export default async function PlatformLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const branding = await getCachedRootLayoutBranding();
  const faviconHref = platformFaviconHref(branding.faviconPath);

  return (
    <AppProviders serverFaviconHref={faviconHref} initialBranding={branding}>
      {children}
    </AppProviders>
  );
}
