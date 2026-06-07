"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAppFaviconDisplay } from "@/lib/hooks/use-app-favicon-src";
import { subscribeDashboardUploadActive } from "@/lib/uploads/dashboard-upload-bus";
import { cn } from "@/lib/utils";

export function DashboardUploadOverlay() {
  const [active, setActive] = useState(false);
  const { src: faviconSrc } = useAppFaviconDisplay();

  useEffect(() => subscribeDashboardUploadActive(setActive), []);

  if (!active) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-background/50 backdrop-blur-[3px]"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Datei wird hochgeladen"
    >
      <div
        className={cn(
          "flex flex-col items-center gap-3 rounded-2xl border border-border/50",
          "bg-card/95 px-8 py-6 shadow-card",
        )}
      >
        {faviconSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={faviconSrc}
            alt=""
            className="size-12 animate-spin object-contain motion-reduce:animate-none"
            decoding="async"
          />
        ) : (
          <Loader2
            className="size-10 animate-spin text-accent motion-reduce:animate-none"
            aria-hidden
          />
        )}
        <p className="text-sm font-medium text-foreground">Wird hochgeladen …</p>
      </div>
    </div>
  );
}
