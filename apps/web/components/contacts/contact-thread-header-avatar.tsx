"use client";

import { ProfileRoundAvatar } from "@/components/ui/profile-round-avatar";
import { contactThreadAvatarInitials } from "@/lib/contacts/contact-thread-avatar-initials";

export function ContactThreadHeaderAvatar({
  avatarUrl,
  displayName,
  firstName,
  lastName,
  /** Listen-Logik (z. B. ☎ statt Nummer im Kreis für WAHA). */
  initialsOverride,
}: {
  avatarUrl: string | null;
  displayName: string;
  firstName?: string | null;
  lastName?: string | null;
  initialsOverride?: string;
}) {
  const initials =
    initialsOverride ??
    contactThreadAvatarInitials({
      displayName,
      firstName,
      lastName,
    });

  return (
    <ProfileRoundAvatar
      src={avatarUrl}
      initials={initials}
      alt={displayName ? `Profilbild ${displayName}` : ""}
      size="lg"
      className="shrink-0"
    />
  );
}
