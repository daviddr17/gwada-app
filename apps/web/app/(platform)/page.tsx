import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";

export const metadata: Metadata = {
  description:
    "Reservierungen, Menü und Branding in einer ruhigen, hochwertigen Oberfläche.",
};

export default function Home() {
  return (
    <div className="min-h-dvh">
      <LandingPage />
    </div>
  );
}
