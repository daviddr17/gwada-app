import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";

export function ChangelogOverviewSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <SkeletonCardFrame key={i} className="space-y-3 p-5">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </SkeletonCardFrame>
      ))}
    </div>
  );
}
