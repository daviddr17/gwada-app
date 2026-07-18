import { PublicGwadaFooter } from "@/components/public/public-gwada-footer";
import { getCachedRootLayoutBranding } from "@/lib/platform/cached-layout-branding";
import { resolvePlatformLogoSrc } from "@/lib/platform/resolve-platform-logo";

export default async function NewsletterPublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const branding = await getCachedRootLayoutBranding();
  const logoSrc = resolvePlatformLogoSrc(branding, "light");
  const appName = branding.appName?.trim() || "gwada";

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <main className="flex flex-1 flex-col">{children}</main>
      <PublicGwadaFooter logoSrc={logoSrc} appName={appName} />
    </div>
  );
}
