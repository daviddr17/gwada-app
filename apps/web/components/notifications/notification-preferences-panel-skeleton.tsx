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
      <SkeletonCardFrame className="space-y-4 p-6">
        <Skeleton className="h-6 w-40 rounded-md" />
        <Skeleton className="h-4 w-full max-w-lg rounded-md" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-4 py-2">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32 rounded-md" />
              <Skeleton className="h-3 w-full max-w-sm rounded-md" />
            </div>
            <Skeleton className="h-9 w-[15.5rem] shrink-0 rounded-full" />
          </div>
        ))}
      </SkeletonCardFrame>
    </div>
  );
}
