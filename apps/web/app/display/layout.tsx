import type { Metadata } from "next";
import { DisplayProviders } from "@/components/providers/display-providers";
import { Toaster } from "@/components/ui/sonner";
import { getCachedRootLayoutBranding } from "@/lib/platform/cached-layout-branding";

export const metadata: Metadata = {
  title: "Display",
  robots: { index: false, follow: false },
};

export default async function DisplayRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const branding = await getCachedRootLayoutBranding();

  return (
    <DisplayProviders initialBranding={branding}>
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
