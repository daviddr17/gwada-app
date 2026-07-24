import { StaffOverviewTableSkeleton } from "@/components/staff/staff-overview-skeleton";
import { AppMain } from "@/components/layout/app-main";

/** Sofortiges Mitarbeiter-Chrome während Soft-Nav / RSC-Flight. */
export default function StaffLoading() {
  return (
    <AppMain>
      <StaffOverviewTableSkeleton />
    </AppMain>
  );
}
