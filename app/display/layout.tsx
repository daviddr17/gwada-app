import type { Metadata } from "next";
import { EmbedProviders } from "@/components/providers/embed-providers";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Display",
  robots: { index: false, follow: false },
};

export default function DisplayRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <EmbedProviders>
      <Toaster position="top-center" richColors closeButton />
      <div className="min-h-dvh bg-background text-foreground">{children}</div>
    </EmbedProviders>
  );
}
