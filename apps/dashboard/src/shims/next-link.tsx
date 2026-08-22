"use client";

import {
  Link,
  type LinkProps,
} from "@tanstack/react-router";
import type { ComponentProps, ReactNode } from "react";

type NextLinkProps = Omit<LinkProps, "to"> & {
  href: string;
  children?: ReactNode;
};

export default function NextLink({
  href,
  children,
  className,
  ...rest
}: NextLinkProps & ComponentProps<"a">) {
  const path = typeof href === "string" ? href.split("?")[0] : "/dashboard";
  const to =
    path === "/dashboard"
      ? "/"
      : path.replace(/^\/dashboard/, "") || "/";
  const searchStr =
    typeof href === "string" && href.includes("?")
      ? href.split("?")[1]
      : undefined;
  const search: Record<string, string> = {};
  if (searchStr) {
    for (const pair of searchStr.split("&")) {
      const [k, v] = pair.split("=");
      if (k) search[k] = decodeURIComponent(v ?? "");
    }
  }

  return (
    <Link to={to} search={search} className={className} {...rest}>
      {children}
    </Link>
  );
}
