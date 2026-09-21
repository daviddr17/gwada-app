"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("SetupWizard");
  const wizard = useRestaurantSetupWizardOptional();

  return (
    <p className={cn("text-sm text-muted-foreground", className)}>
      {t("missingRestaurant")}{" "}
      {wizard ? (
        <button
          type="button"
          className="font-medium text-foreground underline underline-offset-2"
          onClick={() => wizard.openWizard()}
        >
          {t("setupRestaurant")}
        </button>
      ) : (
        <Link
          href="/workspace/restaurants"
          className="font-medium text-foreground underline underline-offset-2"
        >
          {t("selectHere")}
        </Link>
      )}
      .
    </p>
  );
}
