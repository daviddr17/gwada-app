import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import {
  DOCUMENT_TITLE_BRAND,
  formatDocumentTitle,
} from "@/lib/constants/document-title";
import { faviconMimeTypeFromPath, platformFaviconHref } from "@/lib/platform/branding-asset-url";
import { getCachedRootLayoutBranding } from "@/lib/platform/cached-layout-branding";
import { buildGwadaPublicEnvForScript, GWADA_PUBLIC_ENV_HTML_ATTR } from "@/lib/public-env";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "600"],
});

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getCachedRootLayoutBranding();
  const resolvedBrand = branding.appName?.trim() || DOCUMENT_TITLE_BRAND;

  return {
    title: formatDocumentTitle("", resolvedBrand),
    description:
      "Digitale Speisekarte für Restaurants – clean, modern und mandantenfähig.",
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const branding = await getCachedRootLayoutBranding();
  const faviconHref = platformFaviconHref(branding.faviconPath);
  const faviconMime = faviconMimeTypeFromPath(branding.faviconPath);

  const publicEnv = buildGwadaPublicEnvForScript();
  const publicEnvJson =
    publicEnv.supabaseAnonKey?.trim()
      ? JSON.stringify(publicEnv).replace(/</g, "\\u003c")
      : null;

  return (
    <html
      lang="de"
      suppressHydrationWarning
      className={dmSans.variable}
      data-platform-favicon={faviconHref ?? undefined}
      {...(publicEnvJson
        ? { [GWADA_PUBLIC_ENV_HTML_ATTR]: publicEnvJson }
        : {})}
    >
      <head>
        {faviconHref ? (
          <>
            <link
              rel="icon"
              href={faviconHref}
              sizes="any"
              type={faviconMime ?? "image/png"}
              data-platform-branding="favicon"
            />
            <link
              rel="shortcut icon"
              href={faviconHref}
              type={faviconMime ?? "image/png"}
              data-platform-branding="favicon"
            />
            <link
              rel="apple-touch-icon"
              href={faviconHref}
              sizes="180x180"
              type={faviconMime ?? "image/png"}
              data-platform-branding="favicon"
            />
          </>
        ) : null}
      </head>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
