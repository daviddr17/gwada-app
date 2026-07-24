"use client";

import {
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  restaurantLogoCardImageClassName,
  restaurantLogoFrameClassName,
  restaurantLogoHeaderFrameClassName,
  restaurantLogoImageClassName,
  restaurantLogoInnerTileClassName,
  restaurantLogoOuterPaddingClassName,
  restaurantLogoPlateClassName,
} from "@/lib/ui/profile-avatar-image";
import { cn } from "@/lib/utils";

const sizeClasses = {
  sm: "size-9 text-[10px]",
  md: "size-11 text-xs",
  lg: "size-14 text-base",
  card: "size-20 text-xl",
  header: "size-24 text-2xl",
  profile:
    "size-20 text-xl shadow-lg ring-[4px] ring-white/90 dark:ring-background sm:size-24 sm:text-2xl md:size-28 md:text-3xl lg:size-32",
} as const;

export type RestaurantLogoMarkSize = keyof typeof sizeClasses;

export function RestaurantLogoFrame({
  children,
  variant = "default",
  size = "md",
  className,
  style,
  innerClassName,
}: {
  children: ReactNode;
  variant?: "default" | "header" | "profile" | "card";
  size?: RestaurantLogoMarkSize;
  className?: string;
  style?: CSSProperties;
  innerClassName?: string;
}) {
  const outerFrameClassName =
    variant === "header" || variant === "profile"
      ? cn(
          restaurantLogoHeaderFrameClassName,
          restaurantLogoPlateClassName,
          restaurantLogoOuterPaddingClassName,
          variant === "profile" && sizeClasses.profile,
        )
      : cn(
          restaurantLogoFrameClassName,
          restaurantLogoPlateClassName,
          restaurantLogoOuterPaddingClassName,
        );

  return (
    <span
      className={cn(
        outerFrameClassName,
        variant !== "profile" && sizeClasses[size],
        className,
      )}
      style={style}
    >
      <span className={cn(restaurantLogoInnerTileClassName, innerClassName)}>
        {children}
      </span>
    </span>
  );
}

export function RestaurantLogoMark({
  src,
  initials,
  alt = "",
  size = "md",
  variant = "default",
  className,
  style,
  imageClassName,
  innerClassName,
}: {
  src: string | null | undefined;
  initials: string;
  alt?: string;
  size?: RestaurantLogoMarkSize;
  variant?: "default" | "header" | "profile" | "card";
  className?: string;
  style?: CSSProperties;
  imageClassName?: string;
  innerClassName?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => {
    setImageFailed(false);
  }, [src]);
  const hasImage = Boolean(src) && !imageFailed;

  if (variant === "card") {
    return (
      <span
        className={cn(
          restaurantLogoHeaderFrameClassName,
          restaurantLogoPlateClassName,
          sizeClasses[size],
          !hasImage && "font-semibold text-muted-foreground",
          className,
        )}
        style={style}
      >
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src!}
            alt={alt}
            decoding="async"
            onError={() => setImageFailed(true)}
            className={cn(restaurantLogoCardImageClassName, imageClassName)}
          />
        ) : (
          initials
        )}
      </span>
    );
  }

  return (
    <RestaurantLogoFrame
      variant={variant}
      size={size}
      className={cn(
        !hasImage && "font-semibold text-muted-foreground",
        className,
      )}
      style={style}
      innerClassName={innerClassName}
    >
      {hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src!}
          alt={alt}
          decoding="async"
          fetchPriority={variant === "profile" ? "high" : undefined}
          onError={() => setImageFailed(true)}
          className={cn(restaurantLogoImageClassName, imageClassName)}
        />
      ) : (
        initials
      )}
    </RestaurantLogoFrame>
  );
}

export { sizeClasses as restaurantLogoMarkSizeClasses };
