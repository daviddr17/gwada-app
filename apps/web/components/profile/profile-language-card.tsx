"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { APP_LOCALES, type AppLocale } from "@/i18n/config";
import { applyAppLocale } from "@/lib/i18n/apply-app-locale";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";

export function ProfileLanguageCard() {
  const t = useTranslations("Profile.language");
  const tLocale = useTranslations("Locale");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  const selectedLabel = tLocale(locale);

  const onChange = (value: unknown) => {
    const next = typeof value === "string" ? value : null;
    if (!next || next === locale || busy) return;
    setBusy(true);
    void (async () => {
      const result = await applyAppLocale(next);
      if (!result.ok) {
        toast.error(t("updateFailed"));
        setBusy(false);
        return;
      }
      toast.success(t("updated"));
      startTransition(() => {
        router.refresh();
        setBusy(false);
      });
    })();
  };

  return (
    <Card className="border-border/50 shadow-card">
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">{t("heading")}</p>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-language">{t("label")}</Label>
          <Select
            value={locale}
            onValueChange={onChange}
            disabled={busy || pending}
          >
            <SelectTrigger
              id="profile-language"
              className={appSelectTriggerAccentCn(
                "h-11 w-full rounded-xl [&_[data-slot=select-value]]:min-w-0",
              )}
            >
              <SelectValue>{selectedLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {APP_LOCALES.map((code) => (
                <SelectItem key={code} value={code}>
                  {tLocale(code)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
