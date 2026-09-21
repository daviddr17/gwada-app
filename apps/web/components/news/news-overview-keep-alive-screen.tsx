"use client";

import { ModuleHomeKeepAliveShell } from "@/components/navigation/module-home-keep-alive-shell";
import { NewsScreen } from "@/components/news/news-screen";
import { NEWS_MODULE_NAV } from "@/components/news/news-module-nav";

export function NewsOverviewKeepAliveScreen({
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
      title="News"
      subnavAriaLabel="News-Bereiche"
      subnavItems={NEWS_MODULE_NAV}
    >
      <NewsScreen active={active} />
    </ModuleHomeKeepAliveShell>
  );
}
