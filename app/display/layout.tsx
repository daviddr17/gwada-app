import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Display",
  robots: { index: false, follow: false },
};

export default function DisplayRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-dvh bg-background text-foreground">{children}</div>
  );
}
