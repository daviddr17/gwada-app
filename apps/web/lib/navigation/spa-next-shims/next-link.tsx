"use client";

import {
  Link as TanStackLink,
} from "@tanstack/react-router";
import NextLink from "next/dist/client/link";
import type { ComponentProps, ReactNode } from "react";
import {
  dashboardHrefToTanstackTarget,
  isDashboardSpaHref,
} from "@/lib/navigation/dashboard-spa-path";
import { useDashboardSpaNavigationOptional } from "@/lib/navigation/dashboard-spa-navigation-bridge";

type NextLinkProps = ComponentProps<typeof NextLink>;

export default function Link({
  href,
  children,
  className,
  ...rest
}: NextLinkProps & { children?: ReactNode }) {
  const spa = useDashboardSpaNavigationOptional();
  const hrefStr = typeof href === "string" ? href : href.pathname ?? "/dashboard";

  if (!spa || !isDashboardSpaHref(hrefStr)) {
    return (
      <NextLink href={href} className={className} {...rest}>
        {children}
      </NextLink>
    );
  }

  const { to, search } = dashboardHrefToTanstackTarget(hrefStr);
  const tanstackTo =
    Object.keys(search).length > 0
      ? `${to}?${new URLSearchParams(search).toString()}`
      : to;

  return (
    <TanStackLink
      to={tanstackTo}
      className={className}
      {...(rest as ComponentProps<typeof TanStackLink>)}
    >
      {children}
    </TanStackLink>
  );
}
