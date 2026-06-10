import { isRestaurantPositionHexColor } from "@/lib/restaurant/restaurant-position-colors";
import { cn } from "@/lib/utils";

type TagColorStripeProps = {
  color?: string | null;
  className?: string;
};

/** Schmaler Farbbalken links vor Labels (Tags, Positionen, …). */
export function TagColorStripe({ color, className }: TagColorStripeProps) {
  if (!isRestaurantPositionHexColor(color)) return null;
  return (
    <span
      className={cn("mr-1.5 h-5 w-1 shrink-0 rounded-full", className)}
      style={{ backgroundColor: color }}
      aria-hidden
    />
  );
}
