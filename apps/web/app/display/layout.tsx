import type { Metadata, Viewport } from "next";
import { DisplayPwaSetup } from "@/components/display/display-pwa-setup";
import { DisplayPwaSplashPreload } from "@/components/display/display-pwa-splash-preload";
import { DisplayPwaSplashProvider } from "@/components/display/display-pwa-splash-provider";
import { DisplayProviders } from "@/components/providers/display-providers";
import { Toaster } from "@/components/ui/sonner";
import {
  DISPLAY_PWA_MANIFEST_PATH,
  displayPwaIconPath,
} from "@/lib/display/display-pwa-config";
import { getCachedRootLayoutBranding } from "@/lib/platform/cached-layout-branding";

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getCachedRootLayoutBranding();
  const appName = branding.appName.trim() || "gwada";

  return {
    title: {
      default: `${appName} Display`,
      template: `%s · ${appName} Display`,
    },
    description:
      "Restaurant-Display für Schicht, Reservierungen, Bestand und Checklisten.",
    manifest: DISPLAY_PWA_MANIFEST_PATH,
    appleWebApp: {
      capable: true,
      title: `${appName} Display`,
      statusBarStyle: "default",
    },
    icons: {
      apple: [{ url: displayPwaIconPath(180), sizes: "180x180", type: "image/png" }],
    },
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default async function DisplayRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const branding = await getCachedRootLayoutBranding();

  return (
    <DisplayProviders initialBranding={branding}>
      <DisplayPwaSplashPreload />
      <DisplayPwaSplashProvider>
        <DisplayPwaSetup />
        <Toaster position="top-center" richColors closeButton />
        <div
          data-display-root
          className="min-h-dvh bg-background text-foreground"
        >
          {children}
        </div>
      </DisplayPwaSplashProvider>
    </DisplayProviders>
  );
}
