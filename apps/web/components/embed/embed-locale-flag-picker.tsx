"use client";

import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { useEmbedLocaleOptional } from "@/components/embed/embed-locale-provider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AppLocale } from "@/i18n/config";
import { embedLocaleOptions } from "@/lib/embed/embed-locale";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { cn } from "@/lib/utils";

export function EmbedLocaleFlagPicker({
  className,
}: {
  className?: string;
}) {
  const ctx = useEmbedLocaleOptional();
  if (!ctx?.messagesReady) return null;
  return <EmbedLocalePickerInner className={className} />;
}

function EmbedLocalePickerInner({
  className,
}: {
  className?: string;
}) {
  const ctx = useEmbedLocaleOptional();
  const t = useTranslations("Embed");

  if (!ctx) return null;

  const options = embedLocaleOptions();
  const active = options.find((o) => o.locale === ctx.locale) ?? options[0]!;

  return (
    <div
      className={cn(
        "mb-2 flex items-center justify-end gap-2",
        className,
      )}
    >
      <Select
        value={ctx.locale}
        onValueChange={(v) => {
          if (typeof v !== "string") return;
          ctx.setLocale(v as AppLocale);
        }}
      >
        <SelectTrigger
          aria-label={t("languageLabel")}
          className={appSelectTriggerAccentCn(
            "h-9 w-auto min-w-[10.5rem] max-w-full rounded-xl px-3 [&_[data-slot=select-value]]:min-w-0",
          )}
        >
          <SelectValue>
            <span className="flex min-w-0 items-center gap-2">
              <span aria-hidden className="text-base leading-none">
                {active.flag}
              </span>
              <span className="truncate text-sm">{active.label}</span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="end" className="min-w-[10.5rem]">
          {options.map((opt) => (
            <SelectItem
              key={opt.locale}
              value={opt.locale}
              dir={opt.locale === "ar" ? "rtl" : "ltr"}
            >
              <span className="flex items-center gap-2">
                <span aria-hidden className="text-base leading-none">
                  {opt.flag}
                </span>
                <span>{opt.label}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {ctx.contentBusy ? (
        <Loader2
          className="size-3.5 shrink-0 animate-spin text-muted-foreground"
          aria-label={t("translating")}
        />
      ) : null}
    </div>
  );
}
