import { cn } from "@/lib/utils";

/** Profilbilder direkt laden — signierte Supabase-URLs funktionieren nicht zuverlässig mit next/image. */
export function PublicRestaurantImage({
  src,
  alt,
  className,
  fill,
  priority,
  width,
  height,
}: {
  src: string;
  alt: string;
  className?: string;
  fill?: boolean;
  priority?: boolean;
  width?: number;
  height?: number;
}) {
  if (fill) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        decoding="async"
        fetchPriority={priority ? "high" : undefined}
        className={cn("absolute inset-0 size-full object-cover", className)}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      decoding="async"
      fetchPriority={priority ? "high" : undefined}
      className={className}
    />
  );
}
