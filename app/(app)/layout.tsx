import { AppShell } from "@/components/layout/app-shell";
import { AccentColorProvider } from "@/lib/contexts/accent-color-context";
import { RestaurantProfileProvider } from "@/lib/contexts/restaurant-profile-context";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <RestaurantProfileProvider>
      <AccentColorProvider>
        <AppShell>{children}</AppShell>
      </AccentColorProvider>
    </RestaurantProfileProvider>
  );
}
