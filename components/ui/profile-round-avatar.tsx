"use client";

import {
  profileAvatarFallbackPlateClassName,
  profileAvatarImageClassName,
  profileAvatarPlateClassName,
  profileAvatarRingFrameClassName,
} from "@/lib/ui/profile-avatar-image";
import { cn } from "@/lib/utils";

const sizeClasses = {
  xs: "size-6 min-h-6 min-w-6 text-[10px]",
  sm: "size-9 min-h-9 min-w-9 text-xs",
  md: "size-11 min-h-11 min-w-11 text-sm",
  lg: "size-14 min-h-14 min-w-14 text-base",
} as const;

export function ProfileRoundAvatar({
  src,
  initials,
  alt = "",
  size = "sm",
  className,
  imageClassName,
}: {
  src: string | null | undefined;
  initials: string;
  alt?: string;
  size?: keyof typeof sizeClasses;
  className?: string;
  imageClassName?: string;
}) {
  const hasImage = Boolean(src);

  return (
    <span
      className={cn(
        profileAvatarRingFrameClassName,
        sizeClasses[size],
        "leading-none",
        hasImage ? profileAvatarPlateClassName : profileAvatarFallbackPlateClassName,
        !hasImage && "font-semibold text-muted-foreground",
        className,
      )}
      aria-hidden={!alt}
    >
      {hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src!}
          alt={alt}
          decoding="async"
          className={cn(
            profileAvatarImageClassName,
            "rounded-full",
            imageClassName,
          )}
        />
      ) : (
        initials
      )}
    </span>
  );
}
