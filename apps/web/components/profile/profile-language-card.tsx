"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  APP_LOCALE_NATIVE_LABELS,
  APP_LOCALES,
  type AppLocale,
  normalizeAppLocale,
} from "@/i18n/config";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";

export function ProfileLanguageCard({
  value,
  onChange,
  disabled,
}: {
  value: AppLocale;
  onChange: (locale: AppLocale) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("Profile.language");
  const selectedLabel =
    APP_LOCALE_NATIVE_LABELS[value] ?? APP_LOCALE_NATIVE_LABELS.de;

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
            value={value}
            onValueChange={(v) => {
              if (typeof v !== "string") return;
              onChange(normalizeAppLocale(v));
            }}
            disabled={disabled}
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
                <SelectItem
                  key={code}
                  value={code}
                  dir={code === "ar" ? "rtl" : "ltr"}
                >
                  {APP_LOCALE_NATIVE_LABELS[code]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
