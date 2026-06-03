import { AppMain } from "@/components/layout/app-main";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";
import type { ModuleSubnavItem } from "@/components/layout/module-subnav";

const BEWERTUNGEN_NAV: readonly ModuleSubnavItem[] = [
  {
    href: "/bewertungen/gwada",
    label: "Gwada",
    matchMode: "exact",
    activeWhen: ["/bewertungen"],
  },
  { href: "/bewertungen/facebook", label: "Facebook", matchMode: "exact" },
  { href: "/bewertungen/google", label: "Google", matchMode: "exact" },
];

export default function BewertungenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <RegisterModuleChrome
        title="Bewertungen"
        subnavAriaLabel="Bewertungs-Plattformen"
        subnavItems={BEWERTUNGEN_NAV}
      />
      <AppMain>{children}</AppMain>
    </>
  );
}
