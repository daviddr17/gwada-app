"use client";

import { ContactPlatformIcon } from "@/components/contacts/contact-platform-icon";
import type { ContactCatalogPlatform } from "@/lib/constants/contact-catalog-platforms";
import { cn } from "@/lib/utils";

export function ContactPlatformBadges({
  platforms,
  className,
}: {
  platforms: ContactCatalogPlatform[];
  className?: string;
}) {
  if (platforms.length === 0) return null;

  return (
    <span
      className={cn("inline-flex items-center gap-1", className)}
      title={platforms.join(", ")}
    >
      {platforms.map((platform) => (
        <span
          key={platform}
          className="flex size-7 items-center justify-center rounded-lg border border-border/50 bg-background shadow-sm"
        >
          <ContactPlatformIcon platform={platform} />
        </span>
      ))}
    </span>
  );
}
