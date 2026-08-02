import { Suspense } from "react";
import { RestaurantBillingPanel } from "@/components/settings/restaurant-billing-panel";
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";

function BillingFallback() {
  return (
    <div className="space-y-4 pt-2">
      <SkeletonCardFrame className="h-28" />
      <div className="grid gap-3 md:grid-cols-3">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    </div>
  );
}

export default function SettingsBillingPage() {
  return (
    <Suspense fallback={<BillingFallback />}>
      <RestaurantBillingPanel />
    </Suspense>
  );
}
