"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/utils"

const switchTrackClassName = {
  default:
    "h-[18px] w-8 [--switch-padding:2px] [--switch-thumb-size:14px] [--switch-width:32px]",
  sm: "h-3.5 w-6 [--switch-padding:2px] [--switch-thumb-size:10px] [--switch-width:24px]",
} as const

function Switch({
  className,
  size = "default",
  ...props
}: SwitchPrimitive.Root.Props & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 rounded-full border-0 p-[var(--switch-padding)] outline-none transition-colors after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 data-checked:bg-primary data-unchecked:bg-input dark:data-unchecked:bg-input/80 data-disabled:cursor-not-allowed data-disabled:opacity-50",
        switchTrackClassName[size],
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none absolute top-[var(--switch-padding)] left-[var(--switch-padding)] block size-[var(--switch-thumb-size)] rounded-full bg-background ring-0 transition-transform",
          "data-unchecked:translate-x-0",
          "data-checked:translate-x-[calc(var(--switch-width)-var(--switch-thumb-size)-2*var(--switch-padding))]",
          "dark:data-checked:bg-primary-foreground dark:data-unchecked:bg-foreground",
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
