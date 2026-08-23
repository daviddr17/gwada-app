"use client";

import { ModuleHomeKeepAliveShell } from "@/components/navigation/module-home-keep-alive-shell";
import { ReviewsScreen } from "@/components/reviews/reviews-screen";
import { REVIEWS_MODULE_NAV } from "@/components/reviews/reviews-module-nav";

export function ReviewsOverviewKeepAliveScreen({
  active,
  showChrome = active,
}: {
  active: boolean;
  showChrome?: boolean;
}) {
  return (
    <ModuleHomeKeepAliveShell
      active={active}
      showChrome={showChrome}
      title="Bewertungen"
      subnavAriaLabel="Bewertungen-Bereiche"
      subnavItems={REVIEWS_MODULE_NAV}
    >
      <ReviewsScreen active={active} />
    </ModuleHomeKeepAliveShell>
  );
}
