"use client";

import dynamic from "next/dynamic";
import { PlatformProviders } from "@/components/providers/platform-providers";
import type { PlatformAppBranding } from "@/lib/types/platform-app-settings";
import type { SidebarModuleId } from "@/lib/constants/sidebar-modules";

const MarketingAuthRouteTransition = dynamic(
  () =>
    import("@/components/layout/marketing-auth-route-transition").then((m) => ({
      default: m.MarketingAuthRouteTransition,
    })),
  { ssr: false },
);

/** Marketing-Zone: schlanke Provider ohne Toaster, Tooltips oder Supabase-Init. */
export function MarketingProviders({
  children,
  serverFaviconHref,
  initialBranding,
  initialSidebarModuleOrder,
}: {
  children: React.ReactNode;
  serverFaviconHref?: string | null;
  initialBranding?: PlatformAppBranding | null;
  initialSidebarModuleOrder?: SidebarModuleId[] | null;
}) {
  return (
    <PlatformProviders
      serverFaviconHref={serverFaviconHref}
      initialBranding={initialBranding}
      initialSidebarModuleOrder={initialSidebarModuleOrder}
    >
      <MarketingAuthRouteTransition />
      {children}
    </PlatformProviders>
  );
}
