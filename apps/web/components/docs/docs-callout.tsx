import { cn } from "@/lib/utils";

type DocsCalloutVariant = "info" | "tip" | "note";

const VARIANT_CLASS: Record<DocsCalloutVariant, string> = {
  info: "border-blue-500/30 bg-blue-500/8 dark:bg-blue-500/12",
  tip: "border-emerald-500/30 bg-emerald-500/8 dark:bg-emerald-500/12",
  note: "border-border/60 bg-muted/25",
};

const VARIANT_LABEL: Record<DocsCalloutVariant, string> = {
  info: "Hinweis",
  tip: "Tipp",
  note: "Merke",
};

export function DocsCallout({
  variant = "info",
  title,
  children,
  className,
}: {
  variant?: DocsCalloutVariant;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        "rounded-xl border px-4 py-3 text-sm leading-relaxed",
        VARIANT_CLASS[variant],
        className,
      )}
    >
      <p className="font-semibold text-foreground">
        {title ?? VARIANT_LABEL[variant]}
      </p>
      <div className="mt-1 text-muted-foreground [&_strong]:text-foreground [&_a]:text-accent [&_a]:underline-offset-4 [&_a:hover]:underline">
        {children}
      </div>
    </aside>
  );
}
