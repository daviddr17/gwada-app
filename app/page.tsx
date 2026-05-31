import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { LandingPage } from "@/components/landing/landing-page";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Startseite",
  description:
    "Reservierungen, Menü und Branding in einer ruhigen, hochwertigen Oberfläche.",
};

export default function Home() {
  return (
    <div className={`${inter.className} min-h-dvh`}>
      <LandingPage />
    </div>
  );
}
