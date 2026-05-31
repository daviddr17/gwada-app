"use client";

import {
  restaurantLogoFrameClassName,
  restaurantLogoImageClassName,
  restaurantLogoPlateClassName,
} from "@/lib/ui/profile-avatar-image";
import { cn } from "@/lib/utils";

const sizeClasses = {
  sm: "size-9 text-[10px]",
  md: "size-11 text-xs",
  lg: "size-14 text-base",
  card: "size-20 text-xl",
  header: "size-24 text-2xl",
} as const;

export function RestaurantLogoMark({
  src,
  initials,
  alt = "",
  size = "md",
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
        restaurantLogoFrameClassName,
        restaurantLogoPlateClassName,
        sizeClasses[size],
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
          className={cn(restaurantLogoImageClassName, imageClassName)}
        />
      ) : (
        initials
      )}
    </span>
  );
}
