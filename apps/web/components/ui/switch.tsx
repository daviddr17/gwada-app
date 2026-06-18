"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/utils"

const switchTrackClassName = {
  default:
    "h-[18px] w-[32px] [--switch-padding:2px] [--switch-thumb-size:14px]",
  sm: "h-[14px] w-[24px] [--switch-padding:2px] [--switch-thumb-size:10px]",
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
        "peer group/switch relative inline-flex shrink-0 overflow-hidden rounded-full border-0 p-[var(--switch-padding)] outline-none transition-colors after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 data-checked:bg-primary data-unchecked:bg-input dark:data-unchecked:bg-input/80 data-disabled:cursor-not-allowed data-disabled:opacity-50",
        switchTrackClassName[size],
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none absolute top-1/2 block size-[var(--switch-thumb-size)] -translate-y-1/2 rounded-full bg-background ring-0 transition-[left] duration-200 ease-in-out",
          "data-unchecked:left-[var(--switch-padding)]",
          "data-checked:left-[calc(100%-var(--switch-thumb-size)-var(--switch-padding))]",
          "dark:data-checked:bg-primary-foreground dark:data-unchecked:bg-foreground",
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
