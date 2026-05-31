import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";

export function SuperadminStatsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonCardFrame key={i} className="min-h-[5.5rem] space-y-3 py-3">
            <Skeleton className="h-3 w-24 rounded-md" />
            <Skeleton className="h-9 w-16 rounded-lg" />
          </SkeletonCardFrame>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <SkeletonCardFrame className="min-h-[18rem] space-y-4 lg:col-span-3">
          <Skeleton className="h-6 w-48 rounded-md" />
          <Skeleton className="h-[220px] w-full rounded-lg" />
        </SkeletonCardFrame>
        <SkeletonCardFrame className="min-h-[18rem] space-y-4 lg:col-span-2">
          <Skeleton className="h-6 w-40 rounded-md" />
          <Skeleton className="h-[220px] w-full rounded-lg" />
        </SkeletonCardFrame>
      </div>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCardFrame key={i} className="min-h-[16rem] space-y-4">
            <Skeleton className="h-6 w-36 rounded-md" />
            <Skeleton className="h-[200px] w-full rounded-lg" />
          </SkeletonCardFrame>
        ))}
      </div>
    </div>
  );
}
