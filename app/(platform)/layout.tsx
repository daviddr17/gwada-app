import { AppProviders } from "@/components/providers/app-providers";
import { loadRootLayoutBranding } from "@/lib/platform/layout-branding-server";
import { platformFaviconHref } from "@/lib/platform/branding-asset-url";

export default async function PlatformLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const branding = await loadRootLayoutBranding();
  const faviconHref = platformFaviconHref(branding.faviconPath);

  return (
    <AppProviders serverFaviconHref={faviconHref}>{children}</AppProviders>
  );
}
