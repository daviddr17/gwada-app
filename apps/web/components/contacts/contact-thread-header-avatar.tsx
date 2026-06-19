"use client";

import { ProfileRoundAvatar } from "@/components/ui/profile-round-avatar";
import { contactThreadAvatarInitials } from "@/lib/contacts/contact-thread-avatar-initials";

export function ContactThreadHeaderAvatar({
  avatarUrl,
  displayName,
  firstName,
  lastName,
}: {
  avatarUrl: string | null;
  displayName: string;
  firstName?: string | null;
  lastName?: string | null;
}) {
  const initials = contactThreadAvatarInitials({
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
