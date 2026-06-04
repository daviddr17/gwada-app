import { PublicGwadaFooter } from "@/components/public/public-gwada-footer";
import { PublicThemeToggleSlot } from "@/components/public/public-theme-toggle-slot";
import { EmbedProviders } from "@/components/providers/embed-providers";
import { loadRootLayoutBranding } from "@/lib/platform/layout-branding-server";
import { resolvePlatformLogoSrc } from "@/lib/platform/resolve-platform-logo";

export default async function PublicRestaurantProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const branding = await loadRootLayoutBranding();
  const logoSrc = resolvePlatformLogoSrc(branding, "light");
  const appName = branding.appName?.trim() || "gwada";

  return (
    <EmbedProviders>
      <PublicThemeToggleSlot />
      <div className="flex min-h-dvh flex-col">
        <main className="flex-1">{children}</main>
        <PublicGwadaFooter logoSrc={logoSrc} appName={appName} />
      </div>
    </EmbedProviders>
  );
}
