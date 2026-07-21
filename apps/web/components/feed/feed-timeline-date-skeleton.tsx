import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Gleiche Hülle wie die geladene Timeline-Datumsspalte (News/Events). */
export const feedTimelineDateChipClassName =
  "z-10 flex w-full flex-col items-center rounded-lg border border-border/40 bg-background px-1 py-1.5 text-center";

export function FeedTimelineDateSkeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex w-14 shrink-0 flex-col items-center sm:w-16",
        className,
      )}
    >
      <div className={feedTimelineDateChipClassName}>
        <Skeleton className="h-6 w-7 rounded-md sm:h-7" />
        <Skeleton className="mt-1 h-2.5 w-8 rounded-md" />
      </div>
    </div>
  );
}
