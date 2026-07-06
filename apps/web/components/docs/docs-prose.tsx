import { cn } from "@/lib/utils";

export function DocsProse({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <article className={cn("space-y-6", className)}>
      <header className="space-y-2 border-b border-border/50 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="text-muted-foreground">{description}</p>
        ) : null}
      </header>
      <div className="docs-prose space-y-4 text-sm leading-relaxed text-muted-foreground [&_a]:text-accent [&_a]:underline-offset-4 [&_a:hover]:underline [&_code]:rounded-md [&_code]:bg-muted/40 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-foreground [&_h2]:pt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:pt-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_ol]:space-y-2 [&_ol]:pl-5 [&_ol]:list-decimal [&_p strong]:text-foreground [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-border/50 [&_pre]:bg-muted/20 [&_pre]:p-4 [&_pre]:font-mono [&_pre]:text-xs [&_pre]:text-foreground [&_ul]:space-y-2">
        {children}
      </div>
    </article>
  );
}
