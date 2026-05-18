"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"

import { useDrawerFloatingPortalHost } from "@/lib/contexts/drawer-floating-portal"
import { cn } from "@/lib/utils"

function Popover({ ...props }: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

function PopoverTrigger({
  className,
  ...props
}: PopoverPrimitive.Trigger.Props) {
  return (
    <PopoverPrimitive.Trigger
      data-slot="popover-trigger"
      className={cn(className)}
      {...props}
    />
  )
}

function PopoverPortal({
  container: containerProp,
  ...props
}: PopoverPrimitive.Portal.Props) {
  const drawerHost = useDrawerFloatingPortalHost()
  return (
    <PopoverPrimitive.Portal
      data-slot="popover-portal"
      container={containerProp ?? drawerHost ?? undefined}
      {...props}
    />
  )
}

function PopoverPositioner({
  className,
  side = "bottom",
  sideOffset = 8,
  align = "start",
  collisionAvoidance = {
    side: "flip" as const,
    align: "shift" as const,
    fallbackAxisSide: "none" as const,
  },
  collisionPadding = 12,
  ...props
}: PopoverPrimitive.Positioner.Props) {
  return (
    <PopoverPrimitive.Positioner
      data-slot="popover-positioner"
      className={cn(
        "pointer-events-auto isolate z-[340] outline-none",
        className,
      )}
      side={side}
      sideOffset={sideOffset}
      align={align}
      collisionAvoidance={collisionAvoidance}
      collisionPadding={collisionPadding}
      {...props}
    />
  )
}

function PopoverContent({
  className,
  ...props
}: PopoverPrimitive.Popup.Props) {
  return (
    <PopoverPrimitive.Popup
      data-slot="popover-content"
      className={cn(
        "pointer-events-auto z-[340] w-auto origin-(--transform-origin) overflow-hidden rounded-2xl border border-border/60 bg-popover p-0 text-popover-foreground shadow-none outline-none ring-1 ring-black/5 duration-150 dark:shadow-xl dark:ring-white/10",
        "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-[0.98] data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-[0.98]",
        className,
      )}
      {...props}
    />
  )
}

export {
  Popover,
  PopoverTrigger,
  PopoverPortal,
  PopoverPositioner,
  PopoverContent,
}
