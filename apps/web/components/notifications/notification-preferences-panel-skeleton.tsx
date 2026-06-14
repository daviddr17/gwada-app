import { SkeletonCardFrame } from "@/components/ui/skeleton";

export function NotificationPreferencesPanelSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <SkeletonCardFrame className="space-y-3 p-6">
        <div className="skeleton-shimmer h-6 w-36 rounded-md bg-muted" />
        <div className="skeleton-shimmer h-4 w-full max-w-md rounded-md bg-muted" />
        <div className="skeleton-shimmer h-24 rounded-xl bg-muted" />
      </SkeletonCardFrame>
      <SkeletonCardFrame className="space-y-3 p-6">
        <div className="skeleton-shimmer h-6 w-28 rounded-md bg-muted" />
        <div className="skeleton-shimmer h-11 rounded-xl bg-muted" />
        <div className="skeleton-shimmer h-11 rounded-xl bg-muted" />
      </SkeletonCardFrame>
      <SkeletonCardFrame className="space-y-3 p-6">
        <div className="skeleton-shimmer h-6 w-32 rounded-md bg-muted" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton-shimmer h-14 rounded-xl bg-muted" />
        ))}
      </SkeletonCardFrame>
      <SkeletonCardFrame className="space-y-3 p-6">
        <div className="skeleton-shimmer h-6 w-36 rounded-md bg-muted" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={`wa-${i}`} className="skeleton-shimmer h-14 rounded-xl bg-muted" />
        ))}
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={`mail-${i}`} className="skeleton-shimmer h-14 rounded-xl bg-muted" />
        ))}
      </SkeletonCardFrame>
    </div>
  );
}
