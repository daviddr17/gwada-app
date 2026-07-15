import "../marketing-surface.css";
import type { Metadata, Viewport } from "next";
import { DisplayPwaSetup } from "@/components/display/display-pwa-setup";
import { DisplayProviders } from "@/components/providers/display-providers";
import { Toaster } from "@/components/ui/sonner";
import {
  DISPLAY_PWA_MANIFEST_PATH,
  displayPwaIconPath,
} from "@/lib/display/display-pwa-config";
import { PWA_APP_LABEL_DISPLAY } from "@/lib/pwa/pwa-app-labels";
import { getCachedRootLayoutBranding } from "@/lib/platform/cached-layout-branding";

export async function generateMetadata(): Promise<Metadata> {
  await getCachedRootLayoutBranding();
  const displayAppName = PWA_APP_LABEL_DISPLAY;

  return {
    title: {
      default: displayAppName,
      template: `%s · ${displayAppName}`,
    },
    description:
      "Restaurant-Display für Schicht, Reservierungen, Bestand und Checklisten.",
    manifest: DISPLAY_PWA_MANIFEST_PATH,
    appleWebApp: {
      capable: true,
      title: displayAppName,
      statusBarStyle: "default",
    },
    icons: {
      apple: [{ url: displayPwaIconPath(180), sizes: "180x180", type: "image/png" }],
    },
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  viewportFit: "cover",
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
      <DisplayPwaSetup />
      <Toaster position="top-center" richColors closeButton />
      <div
        data-display-root
        className="min-h-dvh bg-background text-foreground"
      >
        {children}
      </div>
    </DisplayProviders>
  );
}
