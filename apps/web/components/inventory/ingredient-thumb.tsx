import { ingredientImagePublicUrl } from "@/lib/inventory/ingredient-image";
import { cn } from "@/lib/utils";

export function IngredientThumb({
  imagePath,
  className,
}: {
  imagePath?: string | null;
  className?: string;
}) {
  const src = ingredientImagePublicUrl(imagePath);
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Storage-URL über /sb, Host erst zur Laufzeit
    <img
      src={src}
      alt=""
      className={cn(
        "size-9 shrink-0 rounded-lg border border-border/50 object-cover",
        className,
      )}
    />
  );
}
