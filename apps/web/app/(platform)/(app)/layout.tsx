import { AppShell } from "@/components/layout/app-shell";
import { AppReservationsLive } from "@/components/providers/app-reservations-live";
import { AppStaffLive } from "@/components/providers/app-staff-live";
import { ProfilePresenceHeartbeat } from "@/components/providers/profile-presence-heartbeat";
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
        <ProfilePresenceHeartbeat />
        <AppReservationsLive />
        <AppStaffLive />
        <AppShell>{children}</AppShell>
      </AccentColorProvider>
    </RestaurantProfileProvider>
  );
}
