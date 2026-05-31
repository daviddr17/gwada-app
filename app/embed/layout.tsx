import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reservierung",
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
  return children;
}
