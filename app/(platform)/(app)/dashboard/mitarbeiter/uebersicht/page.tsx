import { Suspense } from "react";
import { StaffOverviewScreen } from "@/components/staff/staff-overview-screen";

export default function MitarbeiterUebersichtPage() {
  return (
    <Suspense fallback={null}>
      <StaffOverviewScreen />
    </Suspense>
  );
}
