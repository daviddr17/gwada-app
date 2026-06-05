import { FacebookGlyph } from "@/components/icons/facebook-glyph";
import { GoogleGlyph } from "@/components/icons/google-glyph";
import { InstagramGlyph } from "@/components/icons/instagram-glyph";
import type { PublicRestaurantSocialLink } from "@/lib/restaurant/public-restaurant-server";
import { cn } from "@/lib/utils";

const SOCIAL_ARIA: Record<PublicRestaurantSocialLink["kind"], string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  google: "Google",
};

function SocialIcon({ kind }: { kind: PublicRestaurantSocialLink["kind"] }) {
  switch (kind) {
    case "facebook":
      return <FacebookGlyph className="size-4" />;
    case "instagram":
      return <InstagramGlyph className="size-4" />;
    case "google":
      return <GoogleGlyph className="size-4" />;
  }
}

export function PublicProfileSocialChip({
  link,
  className,
}: {
  link: PublicRestaurantSocialLink;
  className?: string;
}) {
  return (
    <a
      href={link.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={SOCIAL_ARIA[link.kind]}
      title={SOCIAL_ARIA[link.kind]}
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/80 text-foreground shadow-sm backdrop-blur-md transition-colors hover:border-accent/40 hover:bg-accent/5",
        className,
      )}
    >
      <SocialIcon kind={link.kind} />
    </a>
  );
}
