import type { Metadata } from "next";
import { EmbedProviders } from "@/components/providers/embed-providers";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Einladung",
  robots: { index: false, follow: false },
};

export default function StaffInviteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <EmbedProviders>
      <Toaster />
      <div className="min-h-dvh w-full bg-background">{children}</div>
    </EmbedProviders>
  );
}
