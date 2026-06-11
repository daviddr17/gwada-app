import { SkeletonCardFrame } from "@/components/ui/skeleton";

export function NotificationPreferencesPanelSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <SkeletonCardFrame className="space-y-4 p-6">
        <div className="skeleton-shimmer h-6 w-24 rounded-md bg-muted" />
        <div className="skeleton-shimmer h-12 rounded-xl bg-muted" />
        <div className="skeleton-shimmer h-12 rounded-xl bg-muted" />
      </SkeletonCardFrame>
      <SkeletonCardFrame className="space-y-3 p-6">
        <div className="skeleton-shimmer h-6 w-32 rounded-md bg-muted" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton-shimmer h-14 rounded-xl bg-muted" />
        ))}
      </SkeletonCardFrame>
    </div>
  );
}
