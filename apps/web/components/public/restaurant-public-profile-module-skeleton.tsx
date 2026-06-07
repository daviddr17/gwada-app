import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";

export function RestaurantPublicProfileModuleSkeleton() {
  return (
    <SkeletonCardFrame className="space-y-4 p-6" aria-busy aria-label="Modul wird geladen">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
      <Skeleton className="h-11 w-full rounded-xl" />
    </SkeletonCardFrame>
  );
}
