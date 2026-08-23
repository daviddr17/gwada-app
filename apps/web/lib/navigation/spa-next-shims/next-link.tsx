"use client";

import { Link as TanStackLink } from "@tanstack/react-router";
import NextLink from "next/dist/client/link";
import type { ComponentProps, ReactNode } from "react";
import { isZoneSpaHref } from "@/lib/navigation/spa-zone-path";
import { useSpaZoneNavigationOptional } from "@/lib/navigation/spa-zone-navigation-bridge";

type NextLinkProps = ComponentProps<typeof NextLink>;

export default function Link({
  href,
  children,
  className,
  ...rest
}: NextLinkProps & { children?: ReactNode }) {
  const spa = useSpaZoneNavigationOptional();
  const hrefStr =
    typeof href === "string" ? href : href.pathname ?? spa?.base ?? "/dashboard";

  if (!spa || !isZoneSpaHref(spa.base, hrefStr)) {
    return (
      <NextLink href={href} className={className} {...rest}>
        {children}
      </NextLink>
    );
  }

  const { to, search } = spa.hrefToTarget(hrefStr);
  const tanstackTo =
    Object.keys(search).length > 0
      ? `${to}?${new URLSearchParams(search).toString()}`
      : to;

  return (
    <TanStackLink
      to={tanstackTo}
      preload="intent"
      className={className}
      {...(rest as ComponentProps<typeof TanStackLink>)}
    >
      {children}
    </TanStackLink>
  );
}
