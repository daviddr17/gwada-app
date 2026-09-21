"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "@/components/providers/theme-provider";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { APP_LAYER_Z_INDEX, appLayerToastZClassName } from "@/lib/ui/app-layer-z-index";
import { cn } from "@/lib/utils";

/** Unter dem App-Header, über Safe-Area / PWA-Titlebar — nicht hinter dem Chrome. */
const TOAST_OFFSET =
  "calc(var(--app-chrome-header-h, 3.25rem) + env(safe-area-inset-top, 0px) + 0.5rem)";

export function Toaster({ className, style, ...props }: ToasterProps) {
  const { theme = "system" } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toaster = (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-center"
      richColors
      closeButton
      gap={8}
      visibleToasts={3}
      offset={TOAST_OFFSET}
      mobileOffset={TOAST_OFFSET}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:rounded-xl group-[.toaster]:border-border/80 group-[.toaster]:bg-popover group-[.toaster]:text-popover-foreground shadow-none dark:shadow-lg",
          title: "group-[.toast]:font-medium",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:rounded-lg group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:rounded-lg group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
      className={cn("toaster group", appLayerToastZClassName, className)}
      style={{ ...style, zIndex: APP_LAYER_Z_INDEX.toast }}
    />
  );

  if (!mounted) return null;
  return createPortal(toaster, document.body);
}
