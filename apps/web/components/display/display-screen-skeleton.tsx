import { DisplayChromeHeader } from "@/components/display/display-chrome-header";
import { Skeleton } from "@/components/ui/skeleton";
import {
  displayChromeMainClassName,
  displayChromeShellClassName,
} from "@/lib/ui/display-chrome";
import { cn } from "@/lib/utils";

/** Bootstrap-Ladezustand der Display-Shell — Accent-Skeleton statt Spinner. */
export function DisplayScreenSkeleton() {
  return (
    <div className={displayChromeShellClassName} aria-busy aria-label="Display wird geladen">
      <DisplayChromeHeader />
      <main className={cn(displayChromeMainClassName, "space-y-4 p-4 sm:p-6")}>
        <div className="flex items-center gap-3">
          <Skeleton className="size-12 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      </main>
    </div>
  );
}
