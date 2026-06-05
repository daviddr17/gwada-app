import { PublicGwadaFooter } from "@/components/public/public-gwada-footer";
import { PublicProfileSplashIntro } from "@/components/public/public-profile-splash-intro";
import { PublicThemeToggleDeferred } from "@/components/public/public-theme-toggle-deferred";
import { EmbedProviders } from "@/components/providers/embed-providers";
import { getCachedRootLayoutBranding } from "@/lib/platform/cached-layout-branding";
import { resolvePublicSplashIconSrc } from "@/lib/platform/resolve-public-splash-icon";
import { resolvePlatformLogoSrc } from "@/lib/platform/resolve-platform-logo";

export const revalidate = 60;

export default async function PublicRestaurantProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const branding = await getCachedRootLayoutBranding();
  const logoSrc = resolvePlatformLogoSrc(branding, "light");
  const splashIconSrc = resolvePublicSplashIconSrc(branding);
  const appName = branding.appName?.trim() || "gwada";

  return (
    <EmbedProviders>
      <PublicThemeToggleDeferred />
      <PublicProfileSplashIntro iconSrc={splashIconSrc}>
        <div className="flex min-h-dvh flex-col">
          <main className="flex-1">{children}</main>
          <PublicGwadaFooter logoSrc={logoSrc} appName={appName} />
        </div>
      </PublicProfileSplashIntro>
    </EmbedProviders>
  );
}
