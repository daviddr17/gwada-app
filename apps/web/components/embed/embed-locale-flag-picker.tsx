"use client";

import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { useEmbedLocaleOptional } from "@/components/embed/embed-locale-provider";
import { embedLocaleOptions } from "@/lib/embed/embed-locale";
import { cn } from "@/lib/utils";

export function EmbedLocaleFlagPicker({
  className,
}: {
  className?: string;
}) {
  const ctx = useEmbedLocaleOptional();
  if (!ctx?.messagesReady) return null;
  return <EmbedLocaleFlagPickerInner className={className} />;
}

function EmbedLocaleFlagPickerInner({
  className,
}: {
  className?: string;
}) {
  const ctx = useEmbedLocaleOptional();
  const t = useTranslations("Embed");

  if (!ctx) return null;

  const options = embedLocaleOptions();

  return (
    <div
      className={cn(
        "mb-3 flex flex-wrap items-center gap-1.5",
        className,
      )}
      role="group"
      aria-label={t("languageLabel")}
    >
      {options.map((opt) => {
        const active = opt.locale === ctx.locale;
        const isSource = opt.locale === ctx.sourceLocale;
        return (
          <button
            key={opt.locale}
            type="button"
            title={
              isSource
                ? `${opt.label} (${t("restaurantDefault")})`
                : opt.label
            }
            aria-pressed={active}
            onClick={() => ctx.setLocale(opt.locale)}
            className={cn(
              "inline-flex size-9 items-center justify-center rounded-full border text-base transition-colors",
              active
                ? "border-foreground/80 bg-background shadow-sm"
                : "border-border/50 bg-background/60 opacity-80 hover:opacity-100",
            )}
          >
            <span aria-hidden>{opt.flag}</span>
            <span className="sr-only">{opt.label}</span>
          </button>
        );
      })}
      {ctx.contentBusy ? (
        <Loader2
          className="ml-1 size-3.5 animate-spin text-muted-foreground"
          aria-label={t("translating")}
        />
      ) : null}
    </div>
  );
}
