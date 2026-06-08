import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";

export function RestaurantFiscalPanelSkeleton() {
  return (
    <div className="space-y-4" aria-busy>
      <SkeletonCardFrame className="space-y-3 p-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-full max-w-md" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      </SkeletonCardFrame>
      <SkeletonCardFrame className="space-y-2 p-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
      </SkeletonCardFrame>
    </div>
  );
}
