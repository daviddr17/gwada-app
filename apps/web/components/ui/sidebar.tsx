"use client"

import * as React from "react"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { useIsMobile } from "@/hooks/use-mobile"
import { AppMobileChromeScreen } from "@/components/layout/app-mobile-chrome-screen"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { PanelLeftIcon } from "lucide-react"

const SIDEBAR_COOKIE_NAME = "sidebar_state"
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7
const SIDEBAR_WIDTH = "16rem"
const SIDEBAR_WIDTH_ICON = "3rem"
const SIDEBAR_KEYBOARD_SHORTCUT = "b"
/** Einheitliche Sidebar-Animation (Breite, Padding, Labels). */
const SIDEBAR_MOTION =
  "duration-[320ms] ease-[cubic-bezier(0.33,1,0.68,1)]"
/** Label-Clip — Breite der Sidebar schneidet Text während der Animation zu. */
const SIDEBAR_LABEL_MOTION = cn(
  "min-w-0 overflow-hidden whitespace-nowrap motion-reduce:transition-none",
)
/** Icon-Spur — feste X-Position in allen Phasen (Rail, Animation, eingeklappt). */
const SIDEBAR_ICON_TRACK_MS = "ms-[5px]"
/** Kompakt-Icons: nur eingeklappt + Animation fertig (nicht während Breiten-Transition). */
const SIDEBAR_COMPACT_BUTTON = cn(
  "group-data-[sidebar-icon-compact]/sidebar-wrapper:w-8",
  "group-data-[sidebar-icon-compact]/sidebar-wrapper:max-w-8",
  "group-data-[sidebar-icon-compact]/sidebar-wrapper:shrink-0",
  "group-data-[sidebar-icon-compact]/sidebar-wrapper:rounded-full",
  "group-data-[sidebar-icon-compact]/sidebar-wrapper:[&>span:last-child]:hidden",
)
/** Label-Spalte zu — nur im stabilen Icon-Modus; während Animation per Clip sichtbar. */
const SIDEBAR_LABELS_COLLAPSED = cn(
  "group-data-[sidebar-labels-collapsed]/sidebar-wrapper:grid-cols-[var(--sidebar-menu-icon-col)_0fr]",
  "group-data-[sidebar-labels-collapsed]/sidebar-wrapper:[&>span:last-child]:pointer-events-none",
)

type SidebarContextProps = {
  state: "expanded" | "collapsed"
  open: boolean
  setOpen: (open: boolean | ((open: boolean) => boolean)) => void
  openMobile: boolean
  setOpenMobile: (open: boolean) => void
  isMobile: boolean
  toggleSidebar: () => void
  sidebarIconCompact: boolean
  sidebarLabelsCollapsed: boolean
  sidebarWidthAnimating: boolean
  setSidebarWidthAnimating: (animating: boolean) => void
}

const SidebarContext = React.createContext<SidebarContextProps | null>(null)

function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.")
  }

  return context
}

function SidebarProvider({
  defaultOpen = true,
  open: openProp,
  onOpenChange: setOpenProp,
  className,
  style,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const isMobile = useIsMobile()
  const [openMobile, setOpenMobile] = React.useState(false)
  const [sidebarWidthAnimating, setSidebarWidthAnimating] = React.useState(false)

  // This is the internal state of the sidebar.
  // We use openProp and setOpenProp for control from outside the component.
  const [_open, _setOpen] = React.useState(defaultOpen)
  const open = openProp ?? _open
  const setOpen = React.useCallback(
    (value: boolean | ((value: boolean) => boolean)) => {
      if (!isMobile) {
        setSidebarWidthAnimating(true)
      }
      const openState = typeof value === "function" ? value(open) : value
      if (setOpenProp) {
        setOpenProp(openState)
      } else {
        _setOpen(openState)
      }

      // This sets the cookie to keep the sidebar state.
      document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`
    },
    [setOpenProp, open, isMobile]
  )

  // Helper to toggle the sidebar.
  const toggleSidebar = React.useCallback(() => {
    if (isMobile) {
      return setOpenMobile((open) => !open)
    }
    setSidebarWidthAnimating(true)
    return setOpen((open) => !open)
  }, [isMobile, setOpen, setOpenMobile])

  React.useEffect(() => {
    if (!sidebarWidthAnimating) return
    const id = window.setTimeout(() => setSidebarWidthAnimating(false), 350)
    return () => window.clearTimeout(id)
  }, [sidebarWidthAnimating])

  // Adds a keyboard shortcut to toggle the sidebar.
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault()
        toggleSidebar()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [toggleSidebar])

  // We add a state so that we can do data-state="expanded" or "collapsed".
  // This makes it easier to style the sidebar with Tailwind classes.
  const state = open ? "expanded" : "collapsed"
  const sidebarIconCompact = !open && !sidebarWidthAnimating
  const sidebarLabelsCollapsed = sidebarIconCompact

  const contextValue = React.useMemo<SidebarContextProps>(
    () => ({
      state,
      open,
      setOpen,
      isMobile,
      openMobile,
      setOpenMobile,
      toggleSidebar,
      sidebarIconCompact,
      sidebarLabelsCollapsed,
      sidebarWidthAnimating,
      setSidebarWidthAnimating,
    }),
    [
      state,
      open,
      setOpen,
      isMobile,
      openMobile,
      setOpenMobile,
      toggleSidebar,
      sidebarIconCompact,
      sidebarLabelsCollapsed,
      sidebarWidthAnimating,
    ]
  )

  return (
    <SidebarContext.Provider value={contextValue}>
      <div
        data-slot="sidebar-wrapper"
        data-sidebar-icon-compact={sidebarIconCompact || undefined}
        data-sidebar-labels-collapsed={sidebarLabelsCollapsed || undefined}
        data-sidebar-width-animating={sidebarWidthAnimating || undefined}
        style={
          {
            "--sidebar-width": SIDEBAR_WIDTH,
            "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
            ...style,
          } as React.CSSProperties
        }
        className={cn(
          "group/sidebar-wrapper flex h-dvh max-h-dvh min-h-0 w-full overflow-hidden has-data-[variant=inset]:bg-app-chrome",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  )
}

function useSidebarWidthTransitionEnd(
  gapRef: React.RefObject<HTMLDivElement | null>,
) {
  const { setSidebarWidthAnimating } = useSidebar()

  React.useEffect(() => {
    const gap = gapRef.current
    if (!gap) return

    const onEnd = (event: TransitionEvent) => {
      if (event.target === gap && event.propertyName === "width") {
        setSidebarWidthAnimating(false)
      }
    }

    gap.addEventListener("transitionend", onEnd)
    return () => gap.removeEventListener("transitionend", onEnd)
  }, [gapRef, setSidebarWidthAnimating])
}

function Sidebar({
  side = "left",
  variant = "sidebar",
  collapsible = "offcanvas",
  className,
  children,
  dir,
  ...props
}: React.ComponentProps<"div"> & {
  side?: "left" | "right"
  variant?: "sidebar" | "floating" | "inset"
  collapsible?: "offcanvas" | "icon" | "none"
}) {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar()
  const gapRef = React.useRef<HTMLDivElement>(null)
  useSidebarWidthTransitionEnd(gapRef)

  if (collapsible === "none") {
    return (
      <div
        data-slot="sidebar"
        className={cn(
          "flex h-full w-(--sidebar-width) flex-col bg-sidebar text-sidebar-foreground",
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }

  if (isMobile) {
    return (
      <AppMobileChromeScreen
        open={openMobile}
        onClose={() => setOpenMobile(false)}
        title="Menü"
        hideTitle
        aria-label="Menü"
      >
        <div
          data-sidebar="sidebar"
          data-slot="sidebar"
          data-mobile="true"
          className="flex h-full w-full flex-col bg-sidebar text-sidebar-foreground"
        >
          {children}
        </div>
      </AppMobileChromeScreen>
    )
  }

  return (
    <div
      className="group peer hidden text-sidebar-foreground md:block"
      data-state={state}
      data-collapsible={state === "collapsed" ? collapsible : ""}
      data-variant={variant}
      data-side={side}
      data-slot="sidebar"
    >
      {/* This is what handles the sidebar gap on desktop */}
      <div
        ref={gapRef}
        data-slot="sidebar-gap"
        className={cn(
          "relative w-(--sidebar-width) bg-transparent transition-[width]",
          SIDEBAR_MOTION,
          "group-data-[collapsible=offcanvas]:w-0",
          "group-data-[side=right]:rotate-180",
          variant === "floating" || variant === "inset"
            ? "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(2))+2px)]"
            : "group-data-[collapsible=icon]:w-(--sidebar-width-icon)"
        )}
      />
      <div
        data-slot="sidebar-container"
        data-side={side}
        className={cn(
          "fixed inset-y-0 z-20 hidden h-svh w-(--sidebar-width) transition-[left,right,width]",
          SIDEBAR_MOTION,
          "data-[side=left]:left-0 data-[side=left]:group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)] data-[side=right]:right-0 data-[side=right]:group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)] md:flex",
          // Adjust the padding for floating and inset variants.
          variant === "floating" || variant === "inset"
            ? variant === "inset"
              ? "pt-0 pb-2 pe-0 ps-0 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(2))+2px)]"
              : "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(2))+2px)]"
            : "group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l",
          className
        )}
        {...props}
      >
        <div
          data-sidebar="sidebar"
          data-slot="sidebar-inner"
          className={cn(
            "flex size-full flex-col bg-app-chrome",
            variant === "inset" &&
              cn(
                "overflow-hidden border-border/50",
                side === "left" &&
                  "rounded-tl-none rounded-bl-lg rounded-e-none border-r",
                side === "right" &&
                  "rounded-tr-none rounded-br-lg rounded-s-none border-l",
              ),
            variant === "floating" &&
              "overflow-hidden border-r border-sidebar-border rounded-lg shadow-none ring-1 ring-sidebar-border dark:shadow-sm",
          )}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

function SidebarTrigger({
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { toggleSidebar } = useSidebar()

  return (
    <Button
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      variant="ghost"
      size="icon-sm"
      className={cn(className)}
      onClick={(event) => {
        onClick?.(event)
        toggleSidebar()
      }}
      {...props}
    >
      <PanelLeftIcon />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  )
}

function SidebarRail({ className, ...props }: React.ComponentProps<"button">) {
  const { toggleSidebar } = useSidebar()

  return (
    <button
      data-sidebar="rail"
      data-slot="sidebar-rail"
      aria-label="Toggle Sidebar"
      tabIndex={-1}
      onClick={toggleSidebar}
      title="Toggle Sidebar"
      className={cn(
        "absolute inset-y-0 z-20 hidden w-4 transition-all ease-linear group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:pointer-events-none after:absolute after:left-1/2 after:top-1/2 after:h-20 after:w-[2px] after:-translate-x-1/2 after:-translate-y-1/2 after:rounded-full after:bg-sidebar-border/70 hover:after:bg-sidebar-border sm:flex ltr:-translate-x-1/2 rtl:-translate-x-1/2",
        "in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize",
        "[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize",
        "group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full hover:group-data-[collapsible=offcanvas]:bg-sidebar",
        "[[data-side=left][data-collapsible=offcanvas]_&]:-right-2",
        "[[data-side=right][data-collapsible=offcanvas]_&]:-left-2",
        className
      )}
      {...props}
    />
  )
}

function SidebarInset({ className, ...props }: React.ComponentProps<"main">) {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn(
        "relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-background transition-[margin]",
        SIDEBAR_MOTION,
        "md:peer-data-[variant=inset]:mb-2 md:peer-data-[variant=inset]:me-2 md:peer-data-[variant=inset]:ms-0 md:peer-data-[variant=inset]:mt-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:rounded-ss-none md:peer-data-[variant=inset]:shadow-none md:peer-data-[variant=inset]:dark:shadow-sm",
        className
      )}
      {...props}
    />
  )
}

function SidebarInput({
  className,
  ...props
}: React.ComponentProps<typeof Input>) {
  return (
    <Input
      data-slot="sidebar-input"
      data-sidebar="input"
      className={cn("h-8 w-full bg-background shadow-none", className)}
      {...props}
    />
  )
}

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-header"
      data-sidebar="header"
      className={cn(
        "flex min-w-0 flex-col gap-2 overflow-hidden p-2",
        className
      )}
      {...props}
    />
  )
}

function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-footer"
      data-sidebar="footer"
      className={cn(
        "flex flex-col gap-2 p-2",
        className
      )}
      {...props}
    />
  )
}

function SidebarSeparator({
  className,
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="sidebar-separator"
      data-sidebar="separator"
      className={cn("mx-2 w-auto bg-sidebar-border", className)}
      {...props}
    />
  )
}

function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-content"
      data-sidebar="content"
      className={cn(
        "no-scrollbar flex min-h-0 flex-1 flex-col gap-0 overflow-auto",
        "group-data-[collapsible=icon]:overflow-x-hidden group-data-[collapsible=icon]:overflow-y-auto",
        "group-data-[sidebar-width-animating]/sidebar-wrapper:overflow-x-hidden",
        className
      )}
      {...props}
    />
  )
}

function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group"
      data-sidebar="group"
      className={cn(
        "relative flex w-full min-w-0 flex-col p-2",
        className
      )}
      {...props}
    />
  )
}

function SidebarGroupLabel({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div"> & React.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(
          "flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 ring-sidebar-ring outline-hidden transition-[margin,opacity] duration-200 ease-linear group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0 focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
          className
        ),
      },
      props
    ),
    render,
    state: {
      slot: "sidebar-group-label",
      sidebar: "group-label",
    },
  })
}

function SidebarGroupAction({
  className,
  render,
  ...props
}: useRender.ComponentProps<"button"> & React.ComponentProps<"button">) {
  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        className: cn(
          "absolute top-3.5 right-3 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground ring-sidebar-ring outline-hidden transition-transform group-data-[collapsible=icon]:hidden after:absolute after:-inset-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 md:after:hidden [&>svg]:size-4 [&>svg]:shrink-0",
          className
        ),
      },
      props
    ),
    render,
    state: {
      slot: "sidebar-group-action",
      sidebar: "group-action",
    },
  })
}

function SidebarGroupContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group-content"
      data-sidebar="group-content"
      className={cn("w-full text-sm", className)}
      {...props}
    />
  )
}

function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu"
      data-sidebar="menu"
      className={cn(
        "flex w-full min-w-0 flex-col gap-0",
        className
      )}
      {...props}
    />
  )
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="sidebar-menu-item"
      data-sidebar="menu-item"
      className={cn(
        "group/menu-item relative min-w-0",
        className
      )}
      {...props}
    />
  )
}

const sidebarMenuButtonVariants = cva(
  cn(
    "cursor-pointer peer/menu-button group/menu-button h-8 rounded-md text-sm ring-sidebar-ring outline-hidden motion-reduce:transition-none",
    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-open:hover:bg-sidebar-accent data-open:hover:text-sidebar-accent-foreground data-active:bg-sidebar-accent data-active:font-medium data-active:text-sidebar-accent-foreground",
  ),
  {
    variants: {
      layout: {
        rail: cn(
          "grid w-full items-center gap-x-2 overflow-hidden p-2 text-left",
          "grid-cols-[var(--sidebar-menu-icon-col)_minmax(0,1fr)] [--sidebar-menu-icon-col:theme(spacing.4)]",
          SIDEBAR_ICON_TRACK_MS,
          "group-has-data-[sidebar=menu-action]/menu-item:pr-8",
          SIDEBAR_LABELS_COLLAPSED,
          SIDEBAR_COMPACT_BUTTON,
          "[&_svg]:col-start-1 [&_svg]:row-start-1 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:place-self-center",
          "[&>span:last-child]:col-start-2 [&>span:last-child]:row-start-1 [&>span:last-child]:truncate [&>span:last-child]:opacity-100",
          SIDEBAR_LABEL_MOTION,
        ),
        text: cn(
          "inline-flex w-auto shrink-0 items-center justify-center px-3 py-1.5 text-center whitespace-nowrap",
          "transition-[background-color,color,box-shadow]",
          SIDEBAR_MOTION,
          "[&>span:last-child]:truncate",
        ),
      },
      variant: {
        default: "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        outline:
          "bg-background shadow-[0_0_0_1px_var(--sidebar-border)] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_var(--sidebar-accent)]",
      },
      size: {
        default: "h-8 text-sm",
        sm: "h-7 text-xs",
        lg: "h-14 min-h-14 rounded-lg text-sm",
      },
    },
    defaultVariants: {
      layout: "rail",
      variant: "default",
      size: "default",
    },
  }
)

function SidebarMenuButton({
  render,
  isActive = false,
  layout = "rail",
  variant = "default",
  size = "default",
  tooltip,
  className,
  ...props
}: useRender.ComponentProps<"button"> &
  React.ComponentProps<"button"> & {
    isActive?: boolean
    tooltip?: string | React.ComponentProps<typeof TooltipContent>
  } & VariantProps<typeof sidebarMenuButtonVariants>) {
  const { isMobile, sidebarWidthAnimating, open } = useSidebar()
  const [tooltipMounted, setTooltipMounted] = React.useState(false)
  React.useEffect(() => setTooltipMounted(true), [])
  const showTooltip =
    tooltipMounted &&
    layout === "rail" &&
    !open &&
    !sidebarWidthAnimating &&
    !isMobile

  const comp = useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        className: cn(sidebarMenuButtonVariants({ layout, variant, size }), className),
      },
      props
    ),
    render,
    state: {
      slot: "sidebar-menu-button",
      sidebar: "menu-button",
      size,
      active: isActive,
    },
  })

  if (!tooltip || !showTooltip) {
    return comp
  }

  if (typeof tooltip === "string") {
    tooltip = {
      children: tooltip,
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger render={comp} />
      <TooltipContent side="right" align="center" {...tooltip} />
    </Tooltip>
  )
}

function SidebarMenuAction({
  className,
  render,
  showOnHover = false,
  ...props
}: useRender.ComponentProps<"button"> &
  React.ComponentProps<"button"> & {
    showOnHover?: boolean
  }) {
  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        className: cn(
          "absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground ring-sidebar-ring outline-hidden transition-transform group-data-[collapsible=icon]:hidden peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[size=default]/menu-button:top-1.5 peer-data-[size=lg]/menu-button:top-2.5 peer-data-[size=sm]/menu-button:top-1 after:absolute after:-inset-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 md:after:hidden [&>svg]:size-4 [&>svg]:shrink-0",
          showOnHover &&
            "group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 peer-data-active/menu-button:text-sidebar-accent-foreground aria-expanded:opacity-100 md:opacity-0",
          className
        ),
      },
      props
    ),
    render,
    state: {
      slot: "sidebar-menu-action",
      sidebar: "menu-action",
    },
  })
}

function SidebarMenuBadge({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-menu-badge"
      data-sidebar="menu-badge"
      className={cn(
        "pointer-events-none absolute right-1 flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-medium text-sidebar-foreground tabular-nums select-none group-data-[collapsible=icon]:hidden peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[size=default]/menu-button:top-1.5 peer-data-[size=lg]/menu-button:top-2.5 peer-data-[size=sm]/menu-button:top-1 peer-data-active/menu-button:text-sidebar-accent-foreground",
        className
      )}
      {...props}
    />
  )
}

function SidebarMenuSkeleton({
  className,
  showIcon = true,
  ...props
}: React.ComponentProps<"div"> & {
  showIcon?: boolean
}) {
  return (
    <div
      data-slot="sidebar-menu-skeleton"
      data-sidebar="menu-skeleton"
      className={cn(
        // Flex statt Label-0fr-Grid — sonst clippt die Textspalte den Balken.
        // Kein flex-1 am Text: volle Breite + ms-[5px] würde rechts abschneiden.
        "flex h-8 w-full min-w-0 items-center gap-2 rounded-md px-2",
        SIDEBAR_ICON_TRACK_MS,
        "group-data-[sidebar-icon-compact]/sidebar-wrapper:w-8 group-data-[sidebar-icon-compact]/sidebar-wrapper:max-w-8 group-data-[sidebar-icon-compact]/sidebar-wrapper:justify-center group-data-[sidebar-icon-compact]/sidebar-wrapper:gap-0 group-data-[sidebar-icon-compact]/sidebar-wrapper:rounded-full group-data-[sidebar-icon-compact]/sidebar-wrapper:px-0 group-data-[sidebar-icon-compact]/sidebar-wrapper:ms-0",
        className,
      )}
      {...props}
    >
      {showIcon ? (
        <Skeleton
          className="size-4 shrink-0 rounded-md"
          data-sidebar="menu-skeleton-icon"
        />
      ) : null}
      <Skeleton
        className={cn(
          "h-3.5 w-[70%] max-w-full min-w-0 shrink rounded-md",
          "group-data-[sidebar-icon-compact]/sidebar-wrapper:hidden",
        )}
        data-sidebar="menu-skeleton-text"
      />
    </div>
  )
}

function SidebarMenuSub({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu-sub"
      data-sidebar="menu-sub"
      className={cn(
        "mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l border-sidebar-border px-2.5 py-0.5 group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    />
  )
}

function SidebarMenuSubItem({
  className,
  ...props
}: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="sidebar-menu-sub-item"
      data-sidebar="menu-sub-item"
      className={cn("group/menu-sub-item relative", className)}
      {...props}
    />
  )
}

function SidebarMenuSubButton({
  render,
  size = "md",
  isActive = false,
  className,
  ...props
}: useRender.ComponentProps<"a"> &
  React.ComponentProps<"a"> & {
    size?: "sm" | "md"
    isActive?: boolean
  }) {
  return useRender({
    defaultTagName: "a",
    props: mergeProps<"a">(
      {
        className: cn(
          "flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 text-sidebar-foreground ring-sidebar-ring outline-hidden group-data-[collapsible=icon]:hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[size=md]:text-sm data-[size=sm]:text-xs data-active:bg-sidebar-accent data-active:text-sidebar-accent-foreground [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-accent-foreground",
          className
        ),
      },
      props
    ),
    render,
    state: {
      slot: "sidebar-menu-sub-button",
      sidebar: "menu-sub-button",
      size,
      active: isActive,
    },
  })
}

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  SIDEBAR_MOTION,
  SIDEBAR_LABEL_MOTION,
  SIDEBAR_COMPACT_BUTTON,
  SIDEBAR_ICON_TRACK_MS,
  useSidebar,
}
