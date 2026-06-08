"use client";

import { LexofficeGlyph } from "@/components/icons/lexoffice-glyph";
import { GwadaFaviconIcon } from "@/components/icons/gwada-favicon-icon";
import {
  CONTACT_CATALOG_PLATFORM_LABELS,
  type ContactCatalogPlatform,
} from "@/lib/constants/contact-catalog-platforms";
import { cn } from "@/lib/utils";

export function ContactPlatformIcon({
  platform,
  className,
  "aria-label": ariaLabel,
}: {
  platform: ContactCatalogPlatform;
  className?: string;
  "aria-label"?: string;
}) {
  const label = ariaLabel ?? CONTACT_CATALOG_PLATFORM_LABELS[platform];

  return (
    <span
      className={cn("inline-flex shrink-0 items-center", className)}
      role="img"
      aria-label={label}
    >
      {platform === "lexoffice" ? (
        <LexofficeGlyph className="size-4" />
      ) : (
        <GwadaFaviconIcon size="chip" />
      )}
    </span>
  );
}
