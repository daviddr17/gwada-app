"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePlatformAppBrandingOptional } from "@/lib/contexts/platform-app-branding-context";
import { useResolvedPlatformLogoSrc } from "@/lib/hooks/use-resolved-platform-logo-src";
import { cn } from "@/lib/utils";

/** App-Logo in der Sidebar direkt über dem Trennstrich zum Footer (Einstellungen …). */
export function AppSidebarBrandLogo({ className }: { className?: string }) {
  const pathname = usePathname();
  const branding = usePlatformAppBrandingOptional();
  const src = useResolvedPlatformLogoSrc();
  const inSuperadmin = pathname.startsWith("/superadmin");
  const href = inSuperadmin ? "/superadmin/allgemein" : "/dashboard";
  const appName = branding?.appName ?? "App";

  if (!src) return null;

  return (
    <div
      className={cn(
        "mt-auto shrink-0 px-2 pb-2 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-1 group-data-[collapsible=icon]:pb-2",
        className,
      )}
    >
      <Link
        href={href}
        prefetch
        className={cn(
          "flex items-center justify-center rounded-lg outline-none ring-sidebar-ring transition-opacity hover:opacity-90 focus-visible:ring-2",
          "group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-1",
        )}
        aria-label={appName}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          decoding="async"
          className={cn(
            "h-9 w-auto max-w-full object-contain object-left",
            "group-data-[collapsible=icon]:size-full group-data-[collapsible=icon]:max-h-none group-data-[collapsible=icon]:object-center",
          )}
        />
      </Link>
    </div>
  );
}
