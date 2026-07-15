import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const MODULE_SECTIONS = 2;
const ITEMS_PER_SECTION = 2;

function NotificationBellModuleSectionSkeleton() {
  return (
    <section className="border-b border-border/40 last:border-b-0">
      <div className="flex items-center justify-between gap-2 px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Skeleton className="size-3.5 shrink-0 rounded-md" />
          <Skeleton className="h-3 w-20 rounded-md" />
          <Skeleton className="h-4 w-5 rounded-full" />
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Skeleton className="size-7 rounded-full" />
          <Skeleton className="h-3 w-8 rounded-md" />
        </div>
      </div>
      <ul className="list-none space-y-0.5 px-2 pb-2" aria-hidden>
        {Array.from({ length: ITEMS_PER_SECTION }).map((_, i) => (
          <li key={i}>
            <div className="flex items-start gap-2 rounded-xl px-2 py-2">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-4 w-full max-w-[10rem] rounded-md" />
                <Skeleton className="h-3 w-full max-w-[14rem] rounded-md" />
              </div>
              <Skeleton className="h-3 w-10 shrink-0 rounded-md" />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function NotificationBellPanelSkeleton({
  layout = "popover",
}: {
  layout?: "popover" | "screen";
} = {}) {
  const isScreen = layout === "screen";
  return (
    <div
      className={cn(
        "flex flex-col",
        isScreen ? "h-full min-h-0 w-full" : "w-[min(100vw-1.5rem,22rem)]",
      )}
      aria-busy
      aria-label="Benachrichtigungen werden geladen"
      aria-hidden
    >
      {!isScreen ? (
        <div className="border-b border-border/50 px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Benachrichtigungen</p>
        </div>
      ) : null}

      <div
        className={cn(
          "overflow-y-auto overscroll-contain",
          isScreen ? "min-h-0 flex-1" : "max-h-[min(70vh,24rem)] min-h-[6rem]",
        )}
      >
        {Array.from({ length: MODULE_SECTIONS }).map((_, i) => (
          <NotificationBellModuleSectionSkeleton key={i} />
        ))}
      </div>

      <div className="border-t border-border/50 p-2">
        <Skeleton className="h-9 w-full rounded-xl" />
      </div>
    </div>
  );
}
