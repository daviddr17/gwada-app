import * as React from "react"

import { cn } from "@/lib/utils"

/** Fläche wie echte `Card`-Inhalte (Border, Radius, Schatten) für Ladezustände. */
function SkeletonCardFrame({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton-card-frame"
      className={cn(
        "rounded-xl border border-border/50 bg-card p-4 shadow-card dark:bg-card/90",
        className,
      )}
      {...props}
    />
  )
}

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "relative skeleton-shimmer min-h-[0.5rem] rounded-xl",
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton, SkeletonCardFrame }
