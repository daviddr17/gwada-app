import { cn } from "@/lib/utils";

/**
 * Profilbilder — Display-Proxy (`/api/public/profile-image`) oder signierte URLs.
 * Kein next/image-Optimizer (signierte/private Storage-Quellen).
 */
export function PublicRestaurantImage({
  src,
  alt,
  className,
  fill,
  priority,
  width,
  height,
  srcSet,
  sizes,
}: {
  src: string;
  alt: string;
  className?: string;
  fill?: boolean;
  priority?: boolean;
  width?: number;
  height?: number;
  srcSet?: string | null;
  sizes?: string;
}) {
  const common = {
    src,
    alt,
    decoding: "async" as const,
    fetchPriority: priority ? ("high" as const) : undefined,
    ...(srcSet ? { srcSet, sizes } : {}),
  };

  if (fill) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        {...common}
        className={cn("absolute inset-0 size-full object-cover", className)}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...common}
      width={width}
      height={height}
      className={className}
    />
  );
}
