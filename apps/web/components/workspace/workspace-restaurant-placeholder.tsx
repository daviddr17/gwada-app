"use client";

import Link from "next/link";
import { useRestaurantSetupWizardOptional } from "@/components/onboarding/restaurant-setup-wizard-provider";
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
  const wizard = useRestaurantSetupWizardOptional();

  return (
    <p className={cn("text-sm text-muted-foreground", className)}>
      Kein Workspace-Restaurant —{" "}
      {wizard ? (
        <button
          type="button"
          className="font-medium text-foreground underline underline-offset-2"
          onClick={() => wizard.openWizard()}
        >
          Restaurant einrichten
        </button>
      ) : (
        <Link
          href="/workspace/restaurants"
          className="font-medium text-foreground underline underline-offset-2"
        >
          hier auswählen
        </Link>
      )}
      .
    </p>
  );
}
