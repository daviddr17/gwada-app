import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Einladung",
  robots: { index: false, follow: false },
};

export default function StaffInviteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-dvh w-full bg-background">{children}</div>
  );
}
