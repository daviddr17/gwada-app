"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"

import { useDrawerFloatingPortalHost } from "@/lib/contexts/drawer-floating-portal"
import { mobileFormControlFontClassName } from "@/lib/ui/mobile-form-control-font"
import { cn } from "@/lib/utils"
import { ChevronDownIcon, CheckIcon, ChevronUpIcon } from "lucide-react"

const defaultCollisionAvoidance = {
  side: "flip" as const,
  align: "shift" as const,
  fallbackAxisSide: "none" as const,
}

/**
 * Base UI Select defaults to `modal: true`, which disables pointer events on the
 * rest of the document while open. Inside Vaul drawers that can leave the UI
 * stuck after close — default to non-modal while keeping the same dropdown UX.
 */
function Select({
  modal = false,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root modal={modal} {...props} />
}

function SelectGroup({ className, ...props }: SelectPrimitive.Group.Props) {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      className={cn("scroll-my-1", className)}
      {...props}
    />
  )
}

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn(
        "min-w-0 flex-1 overflow-hidden text-left text-ellipsis whitespace-nowrap",
        className,
      )}
      {...props}
    />
  )
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: SelectPrimitive.Trigger.Props & {
  size?: "sm" | "default"
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "flex w-full min-w-0 touch-manipulation items-center justify-between gap-2 rounded-2xl border border-border/70 bg-card px-3 py-2 font-medium text-foreground shadow-none transition-[color,box-shadow,background-color,border-color] outline-none select-none hover:border-border focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/45 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground data-[size=default]:min-h-11 data-[size=sm]:min-h-9 data-[size=sm]:rounded-xl data-[size=sm]:px-2.5 *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:shrink *:data-[slot=select-value]:grow *:data-[slot=select-value]:basis-0 dark:border-border/80 dark:bg-input/25 dark:shadow-sm dark:hover:bg-input/40 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        mobileFormControlFontClassName,
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon
        render={
          <ChevronDownIcon className="pointer-events-none size-4 shrink-0 text-muted-foreground" />
        }
      />
    </SelectPrimitive.Trigger>
  )
}

type SelectContentProps = SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    | "align"
    | "alignOffset"
    | "side"
    | "sideOffset"
    | "alignItemWithTrigger"
    | "collisionAvoidance"
    | "collisionPadding"
    | "sticky"
    | "collisionBoundary"
    | "positionMethod"
    | "anchor"
  > &
  Pick<SelectPrimitive.Portal.Props, "container">

function SelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 8,
  align = "start",
  alignOffset = 0,
  alignItemWithTrigger = false,
  collisionAvoidance = defaultCollisionAvoidance,
  collisionPadding = 12,
  sticky = true,
  collisionBoundary,
  positionMethod = "fixed",
  anchor,
  container: portalContainerProp,
  /** Über DatePicker-Popover (z-340) — z. B. Kalender Monat/Jahr in Drawern. */
  elevatedLayer = false,
  ...props
}: SelectContentProps & { elevatedLayer?: boolean }) {
  const drawerFloatingHost = useDrawerFloatingPortalHost()
  const portalContainer =
    portalContainerProp ?? drawerFloatingHost ?? undefined
  const layerZClassName = elevatedLayer ? "z-[350]" : "z-[320]"

  return (
    <SelectPrimitive.Portal container={portalContainer}>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        collisionAvoidance={collisionAvoidance}
        collisionPadding={collisionPadding}
        sticky={sticky}
        collisionBoundary={collisionBoundary}
        positionMethod={positionMethod}
        anchor={anchor}
        className={cn("pointer-events-auto isolate outline-none", layerZClassName)}
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          data-align-trigger={alignItemWithTrigger}
          className={cn(
            "pointer-events-auto relative isolate flex max-h-[min(var(--available-height),22rem)] w-(--anchor-width) min-w-[max(10rem,var(--anchor-width))] max-w-[calc(100vw-1.5rem)] origin-(--transform-origin) flex-col overflow-hidden rounded-2xl border border-border/60 bg-popover text-popover-foreground shadow-none ring-1 ring-black/5 duration-150 dark:shadow-xl dark:ring-white/10",
            layerZClassName,
            "data-[align-trigger=true]:animate-none data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-[0.98] data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-[0.98]",
            className
          )}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List
            data-slot="select-list"
            className="min-h-0 flex-1 scroll-py-1 overflow-y-auto overscroll-contain px-1 py-1.5 outline-none"
          >
            {children}
          </SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({
  className,
  ...props
}: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn(
        "px-2.5 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase",
        className
      )}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex min-h-10 w-full cursor-default items-center gap-2 rounded-xl py-2 pr-9 pl-2.5 text-sm leading-snug text-popover-foreground outline-hidden select-none hover:bg-muted/70 hover:text-foreground focus:bg-muted/80 focus:text-foreground data-disabled:pointer-events-none data-disabled:opacity-45 data-highlighted:bg-muted/80 data-highlighted:text-foreground sm:min-h-9 sm:text-sm [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="flex flex-1 gap-2 whitespace-normal break-words">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator
        render={
          <span className="pointer-events-none absolute right-2 top-1/2 flex size-4 -translate-y-1/2 items-center justify-center text-accent" />
        }
      >
        <CheckIcon className="size-4" aria-hidden />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({
  className,
  ...props
}: SelectPrimitive.Separator.Props) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("pointer-events-none my-1.5 h-px bg-border/70", className)}
      {...props}
    />
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(
        "sticky top-0 z-10 flex w-full shrink-0 cursor-default items-center justify-center border-b border-border/40 bg-popover py-1.5 text-muted-foreground [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <ChevronUpIcon />
    </SelectPrimitive.ScrollUpArrow>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(
        "sticky bottom-0 z-10 flex w-full shrink-0 cursor-default items-center justify-center border-t border-border/40 bg-popover py-1.5 text-muted-foreground [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <ChevronDownIcon />
    </SelectPrimitive.ScrollDownArrow>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
