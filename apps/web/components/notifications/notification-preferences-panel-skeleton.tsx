import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";

export function NotificationPreferencesPanelSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <SkeletonCardFrame className="space-y-3 p-6">
        <Skeleton className="h-6 w-36 rounded-md" />
        <Skeleton className="h-4 w-full max-w-md rounded-md" />
        <Skeleton className="h-24 rounded-xl" />
      </SkeletonCardFrame>
      <SkeletonCardFrame className="space-y-3 p-6">
        <Skeleton className="h-6 w-28 rounded-md" />
        <Skeleton className="h-11 rounded-xl" />
        <Skeleton className="h-11 rounded-xl" />
      </SkeletonCardFrame>
      <SkeletonCardFrame className="space-y-3 p-6">
        <Skeleton className="h-6 w-32 rounded-md" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </SkeletonCardFrame>
      <SkeletonCardFrame className="space-y-3 p-6">
        <Skeleton className="h-6 w-36 rounded-md" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={`wa-${i}`} className="h-14 rounded-xl" />
        ))}
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={`mail-${i}`} className="h-14 rounded-xl" />
        ))}
      </SkeletonCardFrame>
    </div>
  );
}
