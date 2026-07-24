import { ReservationsOverviewSkeleton } from "@/components/reservations/reservations-overview-skeleton";
import { AppMain } from "@/components/layout/app-main";

/** Sofortiges Reservierungs-Chrome während Soft-Nav / RSC-Flight. */
export default function ReservationsLoading() {
  return (
    <AppMain>
      <ReservationsOverviewSkeleton />
    </AppMain>
  );
}
