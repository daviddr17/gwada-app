import { EventsFeedSkeleton } from "@/components/events/events-feed-skeleton";
import { FeedTimelineDateSkeleton } from "@/components/feed/feed-timeline-date-skeleton";
import { NewsFeedSkeleton } from "@/components/news/news-feed-skeleton";
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";

export type ProfileModuleSkeletonVariant =
  | "form"
  | "menu"
  | "timeline"
  | "news"
  | "events";

function ProfileFormSkeleton() {
  return (
    <SkeletonCardFrame className="space-y-4 p-1" aria-busy aria-label="Modul wird geladen">
      <Skeleton className="h-10 w-full rounded-full" />
      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
      <Skeleton className="h-10 w-full rounded-xl" />
      <Skeleton className="h-11 w-full rounded-xl" />
    </SkeletonCardFrame>
  );
}

function ProfileMenuSkeleton() {
  return (
    <div className="space-y-5" aria-busy aria-label="Speisekarte wird geladen">
      <Skeleton className="h-10 w-full rounded-xl" />
      <div className="flex gap-2 overflow-hidden">
        <Skeleton className="h-9 w-24 shrink-0 rounded-full" />
        <Skeleton className="h-9 w-28 shrink-0 rounded-full" />
        <Skeleton className="h-9 w-20 shrink-0 rounded-full" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-3 border-b border-border/40 pb-4">
          <Skeleton className="h-5 w-40" />
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
            </div>
            <Skeleton className="h-4 w-12 shrink-0" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ProfileReviewsTimelineSkeleton() {
  return (
    <ul className="space-y-0" aria-busy aria-label="Bewertungen werden geladen">
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i} className="flex gap-3 pb-3 sm:gap-4">
          <FeedTimelineDateSkeleton />
          <SkeletonCardFrame className="min-w-0 flex-1 space-y-3 rounded-xl border border-border/50 p-3.5 shadow-card sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-5 w-28 rounded-full" />
              <Skeleton className="h-3 w-16 shrink-0 rounded-md" />
            </div>
            <Skeleton className="h-4 w-36 max-w-[55%] rounded-md" />
            <Skeleton className="h-3 w-full rounded-md" />
            <Skeleton className="h-3 w-[85%] rounded-md" />
          </SkeletonCardFrame>
        </li>
      ))}
    </ul>
  );
}

/** Ladeplatzhalter für Profil-Sheet-Module — Form nur für Reservierung. */
export function RestaurantPublicProfileModuleSkeleton({
  variant = "form",
}: {
  variant?: ProfileModuleSkeletonVariant;
}) {
  if (variant === "menu") return <ProfileMenuSkeleton />;
  if (variant === "timeline") return <ProfileReviewsTimelineSkeleton />;
  if (variant === "news") return <NewsFeedSkeleton viewMode="list" />;
  if (variant === "events") return <EventsFeedSkeleton />;
  return <ProfileFormSkeleton />;
}
