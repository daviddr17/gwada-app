import { PublicRestaurantImage } from "@/components/public/public-restaurant-image";

/** Cover-Bild — signierte URLs ohne Next-Optimizer. */
export function RestaurantPublicProfileCoverStatic({
  coverUrl,
  accentHex,
}: {
  coverUrl: string | null;
  accentHex: string;
}) {
  return (
    <div className="relative h-44 overflow-hidden sm:h-52 md:h-60">
      {coverUrl ? (
        <PublicRestaurantImage
          src={coverUrl}
          alt=""
          fill
          priority
          className="object-cover"
        />
      ) : (
        <div
          className="absolute inset-0 overflow-hidden"
          style={{
            background: `linear-gradient(135deg, color-mix(in srgb, ${accentHex} 28%, #f4f6fd) 0%, #f4f6fd 45%, color-mix(in srgb, ${accentHex} 12%, white) 100%)`,
          }}
        >
          <div
            className="gwada-hero-blob gwada-hero-blob-a motion-safe:animate-[gwada-hero-blob-a_22s_ease-in-out_infinite] opacity-70"
            aria-hidden
          />
          <div
            className="gwada-hero-blob gwada-hero-blob-b motion-safe:animate-[gwada-hero-blob-b_26s_ease-in-out_infinite] opacity-50"
            aria-hidden
          />
        </div>
      )}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent"
        aria-hidden
      />
    </div>
  );
}
