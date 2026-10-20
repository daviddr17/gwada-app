import type { Metadata, Viewport } from "next";
import {
  KIOSK_PWA_MANIFEST_PATH,
} from "@/lib/ordering/kiosk-pwa-config";

export const metadata: Metadata = {
  title: {
    default: "Kiosk",
    template: "%s · Kiosk",
  },
  description:
    "Gast-Self-Order-Kiosk (iPad Tisch / Android Counter) — nicht die Website.",
  manifest: KIOSK_PWA_MANIFEST_PATH,
  appleWebApp: {
    capable: true,
    title: "Kiosk",
    statusBarStyle: "black-translucent",
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0a0a",
};

export default function KioskRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div
      data-kiosk-root
      className="h-dvh max-h-dvh overflow-hidden bg-background text-foreground antialiased select-none"
    >
      {children}
    </div>
  );
}
