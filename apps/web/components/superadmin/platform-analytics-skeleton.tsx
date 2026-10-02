import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";
import { SuperadminStatsSkeleton } from "@/components/superadmin/superadmin-stats-skeleton";

export function PlatformAnalyticsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <SuperadminStatsSkeleton />
      <SkeletonCardFrame className="min-h-[18rem] space-y-4">
        <Skeleton className="h-5 w-40 rounded-md" />
        <Skeleton className="h-3 w-64 rounded-md" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </SkeletonCardFrame>
    </div>
  );
}
