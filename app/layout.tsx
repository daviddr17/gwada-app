import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { GwadaPublicEnvScript } from "@/components/gwada-public-env-script";
import { AppProviders } from "@/components/providers/app-providers";
import { isTestEnvironment } from "@/lib/constants/app-environment";
import { formatDocumentTitle } from "@/lib/constants/document-title";
import { faviconMimeTypeFromPath } from "@/lib/platform/branding-asset-url";
import { fetchPlatformAppBranding } from "@/lib/supabase/platform-app-settings-db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export async function generateMetadata(): Promise<Metadata> {
  const sb = await createSupabaseServerClient();
  const branding = sb
    ? await fetchPlatformAppBranding(sb)
    : {
        appName: "gwada",
        faviconUrl: null,
        faviconPath: null,
        logoUrl: null,
        logoDarkUrl: null,
        logoPath: null,
        logoDarkPath: null,
      };
  const brand = branding.appName;
  const documentTitleTemplate = isTestEnvironment()
    ? `${brand} - %s - Testumgebung`
    : `${brand} - %s`;

  return {
    title: {
      template: documentTitleTemplate,
      default: formatDocumentTitle("", brand),
    },
    description:
      "Digitale Speisekarte für Restaurants – clean, modern und mandantenfähig.",
    ...(branding.faviconUrl
      ? {
          icons: {
            icon: [
              {
                url: branding.faviconUrl,
                ...(faviconMimeTypeFromPath(branding.faviconPath)
                  ? { type: faviconMimeTypeFromPath(branding.faviconPath) }
                  : {}),
              },
            ],
            shortcut: [branding.faviconUrl],
          },
        }
      : {}),
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" suppressHydrationWarning className={dmSans.variable}>
      <body className="min-h-dvh font-sans">
        <GwadaPublicEnvScript />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
