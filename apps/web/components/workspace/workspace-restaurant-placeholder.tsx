"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

/** Kurzer Platzhalter, solange die Workspace-Restaurant-ID noch aufgelöst wird. */
export function WorkspaceRestaurantResolvePlaceholder({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn("min-h-[8rem]", className)}
      aria-busy="true"
      aria-label="Workspace wird geladen"
    />
  );
}

export function WorkspaceRestaurantMissingMessage({
  className,
}: {
  className?: string;
}) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)}>
      Kein Workspace-Restaurant —{" "}
      <Link
        href="/workspace/restaurants"
        className="font-medium text-foreground underline underline-offset-2"
      >
        hier auswählen
      </Link>
      .
    </p>
  );
}
