import type { Metadata } from "next";
import { EmbedProviders } from "@/components/providers/embed-providers";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/** Erlaubt Einbettung in fremde Websites (iframe). */
export async function headers() {
  return {
    "Content-Security-Policy": "frame-ancestors *",
  };
}

export default function EmbedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <EmbedProviders>
      <div
        data-gwada-embed-route
        id="gwada-embed-root"
        className="min-h-0 w-full min-w-0 bg-transparent text-foreground"
      >
        {children}
      </div>
    </EmbedProviders>
  );
}
