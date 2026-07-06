"use client"

import * as React from "react"
import { Drawer as DrawerPrimitive } from "vaul"

import { DrawerFloatingPortalContext } from "@/lib/contexts/drawer-floating-portal"
import { appLayerStackedSurfaceZClassName } from "@/lib/ui/app-layer-z-index"
import { drawerFormBodyClassName } from "@/lib/ui/drawer-form-section"
import { cn } from "@/lib/utils"

function Drawer({
  repositionInputs = false,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  return (
    <DrawerPrimitive.Root
      data-slot="drawer"
      repositionInputs={repositionInputs}
      {...props}
    />
  )
}

function DrawerTrigger({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Trigger>) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />
}

function DrawerPortal({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Portal>) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />
}

function DrawerClose({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Close>) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />
}

function DrawerOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Overlay>) {
  return (
    <DrawerPrimitive.Overlay
      data-slot="drawer-overlay"
      className={cn(
        "fixed inset-0 bg-black/20",
        appLayerStackedSurfaceZClassName,
        className
      )}
      {...props}
    />
  )
}

/** Ein Griff — große Hit-Area (44px) für zuverlässiges Runterziehen. */
const drawerHandleClassName =
  "!mx-auto !mt-3 !mb-1 hidden !h-1.5 !w-[100px] shrink-0 !cursor-grab !rounded-full !bg-muted-foreground/40 !opacity-100 active:!cursor-grabbing group-data-[vaul-drawer-direction=bottom]/drawer-content:!block hover:!opacity-100 [&_[data-vaul-handle-hitarea]]:!absolute [&_[data-vaul-handle-hitarea]]:!inset-x-0 [&_[data-vaul-handle-hitarea]]:!top-0 [&_[data-vaul-handle-hitarea]]:!h-12 [&_[data-vaul-handle-hitarea]]:!w-full [&_[data-vaul-handle-hitarea]]:!min-h-0 [&_[data-vaul-handle-hitarea]]:!bg-transparent"

function DrawerContent({
  className,
  children,
  showHandle = true,
  overlayClassName,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Content> & {
  showHandle?: boolean
  overlayClassName?: string
}) {
  const floatingHostRef = React.useRef<HTMLDivElement | null>(null)
  const [, setFloatingHostReady] = React.useState(false)

  const assignFloatingHostRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      floatingHostRef.current = node
      setFloatingHostReady(Boolean(node))
    },
    [],
  )

  return (
    <DrawerPortal data-slot="drawer-portal">
      <DrawerOverlay className={overlayClassName} />
      <DrawerPrimitive.Content
        data-slot="drawer-content"
        className={cn(
          "group/drawer-content relative fixed flex min-h-0 flex-col bg-popover text-sm text-popover-foreground data-[vaul-drawer-direction=bottom]:inset-x-0 data-[vaul-drawer-direction=bottom]:bottom-0 data-[vaul-drawer-direction=bottom]:mt-24 data-[vaul-drawer-direction=bottom]:max-h-[92dvh] data-[vaul-drawer-direction=bottom]:rounded-t-xl data-[vaul-drawer-direction=bottom]:border-t data-[vaul-drawer-direction=bottom]:pb-[env(safe-area-inset-bottom,0px)] data-[vaul-drawer-direction=left]:inset-y-0 data-[vaul-drawer-direction=left]:left-0 data-[vaul-drawer-direction=left]:w-3/4 data-[vaul-drawer-direction=left]:rounded-r-xl data-[vaul-drawer-direction=left]:border-r data-[vaul-drawer-direction=right]:inset-y-0 data-[vaul-drawer-direction=right]:right-0 data-[vaul-drawer-direction=right]:w-3/4 data-[vaul-drawer-direction=right]:rounded-l-xl data-[vaul-drawer-direction=right]:border-r data-[vaul-drawer-direction=top]:inset-x-0 data-[vaul-drawer-direction=top]:top-0 data-[vaul-drawer-direction=top]:mb-24 data-[vaul-drawer-direction=top]:max-h-[92dvh] data-[vaul-drawer-direction=top]:rounded-b-xl data-[vaul-drawer-direction=top]:border-b data-[vaul-drawer-direction=left]:sm:max-w-sm data-[vaul-drawer-direction=right]:sm:max-w-sm",
          appLayerStackedSurfaceZClassName,
          className
        )}
        {...props}
      >
        {showHandle ? (
          <DrawerPrimitive.Handle
            className={drawerHandleClassName}
            aria-hidden
          />
        ) : null}
        <DrawerFloatingPortalContext.Provider value={floatingHostRef}>
          <div
            data-vaul-no-drag=""
            className={cn(drawerFormBodyClassName, "relative z-[1] flex-1")}
          >
            {children}
          </div>
          <div
            ref={assignFloatingHostRef}
            data-slot="drawer-floating-host"
            className="pointer-events-none absolute inset-x-0 bottom-0 top-0 z-[100] min-h-0 overflow-visible"
            aria-hidden
          />
        </DrawerFloatingPortalContext.Provider>
      </DrawerPrimitive.Content>
    </DrawerPortal>
  )
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-header"
      className={cn(
        "flex flex-col gap-0.5 p-4 group-data-[vaul-drawer-direction=bottom]/drawer-content:text-center group-data-[vaul-drawer-direction=top]/drawer-content:text-center md:gap-0.5 md:text-left",
        className
      )}
      {...props}
    />
  )
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn(
        "relative z-10 mt-auto flex shrink-0 flex-col gap-2 border-t border-border/50 bg-card p-4",
        className,
      )}
      {...props}
    />
  )
}

function DrawerTitle({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn(
        "font-heading text-base font-medium text-foreground",
        className
      )}
      {...props}
    />
  )
}

function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Description>) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
}
