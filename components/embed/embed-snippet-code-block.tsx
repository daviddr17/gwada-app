import { cn } from "@/lib/utils";

/** Display-only escape so React does not parse `<script>` in snippet text. */
function escapeSnippetForDisplay(code: string): string {
  return code.replace(/</g, "\u003c");
}

type EmbedSnippetCodeBlockProps = {
  code: string;
  className?: string;
};

export function EmbedSnippetCodeBlock({
  code,
  className,
}: EmbedSnippetCodeBlockProps) {
  return (
    <pre
      className={cn(
        "max-h-52 overflow-auto rounded-xl border border-border/50 bg-muted/30 p-3 text-xs leading-relaxed",
        className,
      )}
    >
      <code>{escapeSnippetForDisplay(code)}</code>
    </pre>
  );
}
