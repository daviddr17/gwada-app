"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Sparkles,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formScheduleTimeInputClassName } from "@/components/ui/date-picker";
import { WEEKDAY_ORDER } from "@/lib/constants/restaurant-profile";
import type { Weekday } from "@/lib/types/restaurant";
import {
  createEmptyRestaurantSetupDraft,
  RESTAURANT_SETUP_PROGRESS_STEPS,
  RESTAURANT_SETUP_STEPS,
  SETUP_ACCENT_PRESETS,
  type RestaurantSetupDraft,
  type RestaurantSetupStep,
  restaurantSetupStepIndex,
  weeklyHoursFromSetupDraft,
} from "@/lib/onboarding/restaurant-setup-steps";
import {
  createWorkspaceRestaurant,
  createWorkspaceRestaurantErrorKey,
} from "@/lib/restaurant/create-workspace-restaurant";
import {
  RESTAURANT_SLUG_TAKEN_MESSAGE,
  restaurantSlugFromName,
} from "@/lib/restaurant/restaurant-slug";
import { acquireAppScrollLock } from "@/lib/layout/app-scroll-root";
import { APP_ROUTES } from "@/lib/navigation/app-routes";
import { applyAccentToDocument, normalizeHex } from "@/lib/theme/color-utils";
import { APP_LAYER_Z_INDEX } from "@/lib/ui/app-layer-z-index";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { MOTION_EASE_OUT } from "@/lib/ui/motion-presets";
import { cn } from "@/lib/utils";

type RestaurantSetupWizardOverlayProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When true, closing without creating is discouraged (no restaurant yet). */
  required?: boolean;
  onCompleted?: (restaurantId: string) => void;
};

function StepShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">
          {title}
        </h2>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground sm:text-[0.95rem]">
          {description}
        </p>
      </div>
      {children}
    </div>
  );
}

export function RestaurantSetupWizardOverlay({
  open,
  onOpenChange,
  required = false,
  onCompleted,
}: RestaurantSetupWizardOverlayProps) {
  const t = useTranslations("SetupWizard");
  const tWeekday = useTranslations("SetupWizard.weekdays");
  const locale = useLocale();
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const [mounted, setMounted] = useState(open);
  const [presented, setPresented] = useState(false);
  const [step, setStep] = useState<RestaurantSetupStep>("welcome");
  const [draft, setDraft] = useState<RestaurantSetupDraft>(
    createEmptyRestaurantSetupDraft,
  );
  const [busy, setBusy] = useState(false);
  const [createdName, setCreatedName] = useState("");

  useEffect(() => {
    if (open) {
      setMounted(true);
      setStep("welcome");
      setDraft(createEmptyRestaurantSetupDraft());
      setCreatedName("");
      setBusy(false);
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setPresented(true));
      });
      return () => cancelAnimationFrame(frame);
    }
    setPresented(false);
    const timer = window.setTimeout(
      () => setMounted(false),
      reducedMotion ? 0 : 280,
    );
    return () => window.clearTimeout(timer);
  }, [open, reducedMotion]);

  useEffect(() => {
    if (!mounted) return;
    return acquireAppScrollLock();
  }, [mounted]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (required && step !== "done") return;
      onOpenChange(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange, required, step]);

  const slugPreview = useMemo(() => {
    const fromName = restaurantSlugFromName(draft.name);
    return fromName || "…";
  }, [draft.name]);

  const progressIndex = RESTAURANT_SETUP_PROGRESS_STEPS.indexOf(
    step as (typeof RESTAURANT_SETUP_PROGRESS_STEPS)[number],
  );

  const patchDraft = useCallback((patch: Partial<RestaurantSetupDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const toggleWeekday = useCallback((day: Weekday) => {
    setDraft((prev) => {
      const has = prev.openWeekdays.includes(day);
      return {
        ...prev,
        openWeekdays: has
          ? prev.openWeekdays.filter((d) => d !== day)
          : [...prev.openWeekdays, day],
      };
    });
  }, []);

  const goNext = useCallback(() => {
    const idx = restaurantSetupStepIndex(step);
    const next = RESTAURANT_SETUP_STEPS[idx + 1];
    if (next) setStep(next);
  }, [step]);

  const goBack = useCallback(() => {
    const idx = restaurantSetupStepIndex(step);
    const prev = RESTAURANT_SETUP_STEPS[idx - 1];
    if (prev) setStep(prev);
  }, [step]);

  const finishCreate = useCallback(async () => {
    if (busy) return;
    const name = draft.name.trim();
    if (!name) {
      toast.error(t("errors.nameRequired"));
      setStep("identity");
      return;
    }
    if (draft.openWeekdays.length === 0) {
      toast.error(t("errors.hoursRequired"));
      setStep("hours");
      return;
    }

    setBusy(true);
    try {
      const accent = normalizeHex(draft.accentHex) ?? draft.accentHex;
      applyAccentToDocument(accent);

      const result = await createWorkspaceRestaurant({
        name,
        street: draft.street,
        postalCode: draft.postalCode,
        city: draft.city,
        country: draft.country || "DE",
        weeklyHours: weeklyHoursFromSetupDraft(draft),
        accentHex: accent,
      });

      if (!result.ok) {
        const errKey = createWorkspaceRestaurantErrorKey(result.error);
        toast.error(
          errKey === "slug_taken"
            ? RESTAURANT_SLUG_TAKEN_MESSAGE
            : t(errKey),
        );
        return;
      }

      setCreatedName(name);
      setStep("done");
      onCompleted?.(result.restaurantId);
    } finally {
      setBusy(false);
    }
  }, [busy, draft, onCompleted, t]);

  const handlePrimary = useCallback(() => {
    if (step === "welcome") {
      goNext();
      return;
    }
    if (step === "identity") {
      if (!draft.name.trim()) {
        toast.error(t("errors.nameRequired"));
        return;
      }
      goNext();
      return;
    }
    if (step === "location" || step === "hours") {
      goNext();
      return;
    }
    if (step === "look") {
      void finishCreate();
      return;
    }
    if (step === "done") {
      onOpenChange(false);
      router.push(APP_ROUTES.dashboard);
      router.refresh();
    }
  }, [step, draft.name, goNext, finishCreate, onOpenChange, router, t]);

  if (!mounted || typeof document === "undefined") return null;

  const showProgress = progressIndex >= 0;
  const canClose = !required || step === "done";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("ariaLabel")}
      className="fixed inset-0 flex items-stretch justify-center sm:items-center sm:p-6"
      style={{ zIndex: APP_LAYER_Z_INDEX.stackedSurface + 10 }}
    >
      <motion.button
        type="button"
        aria-label={canClose ? t("close") : undefined}
        tabIndex={canClose ? 0 : -1}
        className={cn(
          "absolute inset-0 border-0 bg-background/55 backdrop-blur-xl",
          !canClose && "cursor-default",
        )}
        initial={false}
        animate={{ opacity: presented ? 1 : 0 }}
        transition={{ duration: reducedMotion ? 0.01 : 0.28, ease: MOTION_EASE_OUT }}
        onClick={() => {
          if (canClose) onOpenChange(false);
        }}
      />

      {/* Atmosphere */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden
      >
        <div
          className="absolute -left-1/4 top-[-20%] h-[55%] w-[70%] rounded-full opacity-40 blur-3xl"
          style={{
            background: `radial-gradient(circle, color-mix(in oklch, ${draft.accentHex} 55%, transparent), transparent 70%)`,
          }}
        />
        <div
          className="absolute -right-1/5 bottom-[-15%] h-[50%] w-[60%] rounded-full opacity-30 blur-3xl"
          style={{
            background: `radial-gradient(circle, color-mix(in oklch, ${draft.accentHex} 40%, transparent), transparent 70%)`,
          }}
        />
      </div>

      <motion.div
        className={cn(
          "relative flex h-full w-full max-w-lg flex-col overflow-hidden",
          "border-border/40 bg-background/90 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.45)] backdrop-blur-2xl",
          "sm:h-auto sm:max-h-[min(40rem,calc(100dvh-3rem))] sm:rounded-[1.75rem] sm:border",
        )}
        initial={false}
        animate={
          presented
            ? { opacity: 1, y: 0, scale: 1 }
            : {
                opacity: 0,
                y: reducedMotion ? 0 : 28,
                scale: reducedMotion ? 1 : 0.98,
              }
        }
        transition={{ duration: reducedMotion ? 0.01 : 0.34, ease: MOTION_EASE_OUT }}
      >
        <header className="flex items-center justify-between gap-3 px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))] sm:px-7 sm:pt-6">
          <div className="flex items-center gap-2.5">
            <span
              className="flex size-9 items-center justify-center rounded-full"
              style={{
                background: `color-mix(in oklch, ${draft.accentHex} 18%, transparent)`,
                color: draft.accentHex,
              }}
            >
              <UtensilsCrossed className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium tracking-tight">
                {t("brand")}
              </p>
              {showProgress ? (
                <p className="text-xs text-muted-foreground">
                  {t("stepOf", {
                    current: progressIndex + 1,
                    total: RESTAURANT_SETUP_PROGRESS_STEPS.length,
                  })}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">{t("tagline")}</p>
              )}
            </div>
          </div>
          {canClose ? (
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="rounded-full"
              onClick={() => onOpenChange(false)}
              aria-label={t("close")}
            >
              <X className="size-4" />
            </Button>
          ) : (
            <span className="size-8" aria-hidden />
          )}
        </header>

        {showProgress ? (
          <div className="px-5 sm:px-7">
            <div className="flex gap-1.5">
              {RESTAURANT_SETUP_PROGRESS_STEPS.map((key, i) => (
                <div
                  key={key}
                  className="h-1 flex-1 overflow-hidden rounded-full bg-muted"
                >
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: draft.accentHex }}
                    initial={false}
                    animate={{ width: i <= progressIndex ? "100%" : "0%" }}
                    transition={{
                      duration: reducedMotion ? 0.01 : 0.35,
                      ease: MOTION_EASE_OUT,
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-7">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${locale}-${step}`}
              initial={
                reducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: 14, filter: "blur(6px)" }
              }
              animate={
                reducedMotion
                  ? { opacity: 1 }
                  : { opacity: 1, y: 0, filter: "blur(0px)" }
              }
              exit={
                reducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: -10, filter: "blur(4px)" }
              }
              transition={{ duration: reducedMotion ? 0.01 : 0.28, ease: MOTION_EASE_OUT }}
            >
              {step === "welcome" ? (
                <div className="flex min-h-[18rem] flex-col justify-center space-y-6 py-4">
                  <div
                    className="inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
                    style={{
                      background: `color-mix(in oklch, ${draft.accentHex} 14%, transparent)`,
                      color: draft.accentHex,
                    }}
                  >
                    <Sparkles className="size-3.5" />
                    {t("welcome.eyebrow")}
                  </div>
                  <div className="space-y-3">
                    <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                      {t("welcome.title")}
                    </h2>
                    <p className="max-w-md text-base leading-relaxed text-muted-foreground">
                      {t("welcome.description")}
                    </p>
                  </div>
                </div>
              ) : null}

              {step === "identity" ? (
                <StepShell
                  title={t("identity.title")}
                  description={t("identity.description")}
                >
                  <div className="space-y-2">
                    <Label htmlFor="setup-name">{t("identity.nameLabel")}</Label>
                    <Input
                      id="setup-name"
                      value={draft.name}
                      onChange={(e) => patchDraft({ name: e.target.value })}
                      placeholder={t("identity.namePlaceholder")}
                      className="h-12 rounded-2xl text-base"
                      autoComplete="organization"
                      autoFocus
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("identity.slugHint", { slug: slugPreview })}
                    </p>
                  </div>
                </StepShell>
              ) : null}

              {step === "location" ? (
                <StepShell
                  title={t("location.title")}
                  description={t("location.description")}
                >
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="setup-street">
                        {t("location.streetLabel")}
                      </Label>
                      <Input
                        id="setup-street"
                        value={draft.street}
                        onChange={(e) => patchDraft({ street: e.target.value })}
                        placeholder={t("location.streetPlaceholder")}
                        className="h-11 rounded-xl"
                        autoComplete="street-address"
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="setup-zip">
                          {t("location.postalLabel")}
                        </Label>
                        <Input
                          id="setup-zip"
                          value={draft.postalCode}
                          onChange={(e) =>
                            patchDraft({ postalCode: e.target.value })
                          }
                          className="h-11 rounded-xl"
                          autoComplete="postal-code"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="setup-city">
                          {t("location.cityLabel")}
                        </Label>
                        <Input
                          id="setup-city"
                          value={draft.city}
                          onChange={(e) => patchDraft({ city: e.target.value })}
                          className="h-11 rounded-xl"
                          autoComplete="address-level2"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="setup-country">
                        {t("location.countryLabel")}
                      </Label>
                      <Input
                        id="setup-country"
                        value={draft.country}
                        onChange={(e) =>
                          patchDraft({ country: e.target.value })
                        }
                        placeholder={t("location.countryPlaceholder")}
                        className="h-11 rounded-xl"
                        autoComplete="country"
                      />
                    </div>
                  </div>
                </StepShell>
              ) : null}

              {step === "hours" ? (
                <StepShell
                  title={t("hours.title")}
                  description={t("hours.description")}
                >
                  <div className="space-y-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        type="time"
                        value={draft.openTime}
                        onChange={(e) =>
                          patchDraft({ openTime: e.target.value })
                        }
                        className={cn(formScheduleTimeInputClassName, "h-11")}
                        aria-label={t("hours.openLabel")}
                      />
                      <span className="text-muted-foreground">–</span>
                      <Input
                        type="time"
                        value={draft.closeTime}
                        onChange={(e) =>
                          patchDraft({ closeTime: e.target.value })
                        }
                        className={cn(formScheduleTimeInputClassName, "h-11")}
                        aria-label={t("hours.closeLabel")}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {WEEKDAY_ORDER.map((day) => {
                        const active = draft.openWeekdays.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => toggleWeekday(day)}
                            className={cn(
                              "rounded-full border px-3 py-1.5 text-sm transition-colors",
                              active
                                ? "border-transparent text-white"
                                : "border-border/60 bg-background text-muted-foreground hover:border-border hover:text-foreground",
                            )}
                            style={
                              active
                                ? { background: draft.accentHex }
                                : undefined
                            }
                          >
                            {tWeekday(day)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </StepShell>
              ) : null}

              {step === "look" ? (
                <StepShell
                  title={t("look.title")}
                  description={t("look.description")}
                >
                  <div className="space-y-5">
                    <div className="flex flex-wrap gap-3">
                      {SETUP_ACCENT_PRESETS.map((hex) => {
                        const selected =
                          normalizeHex(draft.accentHex) === normalizeHex(hex);
                        return (
                          <button
                            key={hex}
                            type="button"
                            aria-label={hex}
                            onClick={() => {
                              patchDraft({ accentHex: hex });
                              applyAccentToDocument(hex);
                            }}
                            className={cn(
                              "relative size-11 rounded-full border-2 transition-transform",
                              selected
                                ? "scale-105 border-foreground"
                                : "border-transparent hover:scale-105",
                            )}
                            style={{ background: hex }}
                          >
                            {selected ? (
                              <Check className="absolute inset-0 m-auto size-4 text-white drop-shadow" />
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                    <div
                      className="rounded-2xl border border-border/40 p-4"
                      style={{
                        background: `linear-gradient(135deg, color-mix(in oklch, ${draft.accentHex} 16%, var(--background)), var(--background))`,
                      }}
                    >
                      <p className="text-sm font-medium">
                        {draft.name.trim() || t("look.previewFallback")}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("look.previewHint")}
                      </p>
                    </div>
                  </div>
                </StepShell>
              ) : null}

              {step === "done" ? (
                <div className="flex min-h-[18rem] flex-col justify-center space-y-6 py-4 text-center">
                  <div
                    className="mx-auto flex size-16 items-center justify-center rounded-full"
                    style={{
                      background: `color-mix(in oklch, ${draft.accentHex} 18%, transparent)`,
                      color: draft.accentHex,
                    }}
                  >
                    <Check className="size-7" strokeWidth={2.5} />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-3xl font-semibold tracking-tight">
                      {t("done.title")}
                    </h2>
                    <p className="text-base text-muted-foreground">
                      {t("done.description", {
                        name: createdName || draft.name.trim(),
                      })}
                    </p>
                  </div>
                </div>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>

        <footer className="flex items-center gap-2 border-t border-border/40 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-7">
          {step !== "welcome" && step !== "done" ? (
            <Button
              type="button"
              variant="ghost"
              className="rounded-xl"
              onClick={goBack}
              disabled={busy}
            >
              <ArrowLeft className="size-4" />
              {t("back")}
            </Button>
          ) : (
            <span className="flex-1" />
          )}
          <div className="flex-1" />
          <Button
            type="button"
            size="lg"
            disabled={busy}
            className={cn(
              "min-w-[9.5rem] gap-2",
              brandActionButtonRoundedClassName,
            )}
            onClick={handlePrimary}
          >
            {step === "look"
              ? busy
                ? t("creating")
                : t("finish")
              : step === "done"
                ? t("launch")
                : t("continue")}
            {step !== "look" && step !== "done" ? (
              <ArrowRight className="size-4" />
            ) : null}
          </Button>
        </footer>
      </motion.div>
    </div>,
    document.body,
  );
}
