"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CopyToClipboardButton({
  value,
  label,
  className,
  disabled,
}: {
  value: string;
  /** Für Toast und aria-label, z. B. „Reservierungsnummer“. */
  label: string;
  className?: string;
  disabled?: boolean;
}) {
  const copy = async () => {
    if (!value.trim() || disabled) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} kopiert`);
    } catch {
      toast.error("Kopieren fehlgeschlagen");
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      disabled={disabled || !value.trim()}
      className={cn(
        "size-7 shrink-0 text-muted-foreground hover:text-foreground",
        className,
      )}
      aria-label={`${label} kopieren`}
      onClick={() => void copy()}
    >
      <Copy className="size-3.5" aria-hidden />
    </Button>
  );
}
