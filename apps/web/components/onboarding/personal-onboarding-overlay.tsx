"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Languages,
  Sparkles,
  UserRound,
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
import {
  APP_LOCALE_NATIVE_LABELS,
  APP_LOCALES,
  type AppLocale,
  normalizeAppLocale,
} from "@/i18n/config";
import { applyAppLocale } from "@/lib/i18n/apply-app-locale";
import { acquireAppScrollLock } from "@/lib/layout/app-scroll-root";
import {
  createEmptyPersonalOnboardingDraft,
  PERSONAL_ONBOARDING_PROGRESS_STEPS,
  type PersonalOnboardingDraft,
  type PersonalOnboardingStep,
} from "@/lib/onboarding/personal-onboarding-steps";
import { syncUserProfileNames } from "@/lib/profile/sync-user-profile-names";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { DEFAULT_ACCENT_HEX } from "@/lib/theme/constants";
import { APP_LAYER_Z_INDEX } from "@/lib/ui/app-layer-z-index";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { MOTION_EASE_OUT } from "@/lib/ui/motion-presets";
import { cn } from "@/lib/utils";

type PersonalOnboardingOverlayProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  required?: boolean;
  seed?: Partial<PersonalOnboardingDraft>;
  onCompleted?: () => void;
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

export function PersonalOnboardingOverlay({
  open,
  onOpenChange,
  required = false,
  seed,
  onCompleted,
}: PersonalOnboardingOverlayProps) {
  const t = useTranslations("PersonalOnboarding");
  const locale = useLocale();
  const router = useRouter();
  const reducedMotion = useReducedMotion() ?? false;
  const accent = DEFAULT_ACCENT_HEX;

  const [mounted, setMounted] = useState(open);
  const [presented, setPresented] = useState(false);
  const [step, setStep] = useState<PersonalOnboardingStep>("welcome");
  const [draft, setDraft] = useState<PersonalOnboardingDraft>(() =>
    createEmptyPersonalOnboardingDraft(seed),
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setStep("welcome");
      setDraft(createEmptyPersonalOnboardingDraft(seed));
      setBusy(false);
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setPresented(true));
      });
      return () => cancelAnimationFrame(frame);
    }
    setPresented(false);
    const timer = window.setTimeout(
      () => setMounted(false),
      reducedMotion ? 10 : 320,
    );
    return () => window.clearTimeout(timer);
  }, [open, reducedMotion, seed]);

  useEffect(() => {
    if (!open) return;
    return acquireAppScrollLock();
  }, [open]);

  const progressIndex = useMemo(() => {
    const idx = PERSONAL_ONBOARDING_PROGRESS_STEPS.indexOf(
      step as (typeof PERSONAL_ONBOARDING_PROGRESS_STEPS)[number],
    );
    return idx;
  }, [step]);

  const goNext = useCallback(() => {
    const order: PersonalOnboardingStep[] = [
      "welcome",
      "language",
      "identity",
      "contact",
      "done",
    ];
    const i = order.indexOf(step);
    if (i >= 0 && i < order.length - 1) setStep(order[i + 1]!);
  }, [step]);

  const goBack = useCallback(() => {
    const order: PersonalOnboardingStep[] = [
      "welcome",
      "language",
      "identity",
      "contact",
      "done",
    ];
    const i = order.indexOf(step);
    if (i > 0) setStep(order[i - 1]!);
  }, [step]);

  const finish = useCallback(async () => {
    const firstName = draft.firstName.trim();
    const lastName = draft.lastName.trim();
    if (!firstName || !lastName) {
      toast.error(t("errors.namesRequired"));
      setStep("identity");
      return;
    }

    setBusy(true);
    try {
      const localeResult = await applyAppLocale(draft.locale);
      if (!localeResult.ok) {
        toast.error(t("errors.localeFailed"));
        setBusy(false);
        return;
      }

      const sbNames = createSupabaseBrowserClient();
      const names = await syncUserProfileNames(sbNames, {
        givenName: firstName,
        familyName: lastName,
      });
      if (!names.ok) {
        toast.error(t("errors.namesFailed"));
        setBusy(false);
        return;
      }

      const phone = draft.phone.trim();
      if (phone) {
        const contactRes = await fetch("/api/profile/notification-contact", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone }),
        });
        if (!contactRes.ok) {
          toast.error(t("errors.phoneFailed"));
          setBusy(false);
          return;
        }
      }

      const sb = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) {
        toast.error(t("errors.authRequired"));
        setBusy(false);
        return;
      }

      const { error } = await sb
        .from("profiles")
        .update({
          personal_onboarding_completed_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) {
        toast.error(t("errors.saveFailed"));
        setBusy(false);
        return;
      }

      setStep("done");
      onCompleted?.();
      router.refresh();
    } catch {
      toast.error(t("errors.saveFailed"));
    } finally {
      setBusy(false);
    }
  }, [draft, onCompleted, router, t]);

  const primaryAction = useCallback(() => {
    if (step === "welcome") {
      goNext();
      return;
    }
    if (step === "language") {
      void (async () => {
        setBusy(true);
        const result = await applyAppLocale(draft.locale);
        setBusy(false);
        if (!result.ok) {
          toast.error(t("errors.localeFailed"));
          return;
        }
        router.refresh();
        goNext();
      })();
      return;
    }
    if (step === "identity") {
      if (!draft.firstName.trim() || !draft.lastName.trim()) {
        toast.error(t("errors.namesRequired"));
        return;
      }
      goNext();
      return;
    }
    if (step === "contact") {
      void finish();
      return;
    }
    if (step === "done") {
      onOpenChange(false);
    }
  }, [step, draft, goNext, finish, onOpenChange, t, router]);

  if (!mounted || typeof document === "undefined") return null;

  const showProgress = progressIndex >= 0;
  const canClose = !required || step === "done";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("ariaLabel")}
      className="fixed inset-0 flex items-stretch justify-center sm:items-center sm:p-6"
      style={{ zIndex: APP_LAYER_Z_INDEX.stackedSurface + 12 }}
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
        transition={{
          duration: reducedMotion ? 0.01 : 0.28,
          ease: MOTION_EASE_OUT,
        }}
        onClick={() => {
          if (canClose) onOpenChange(false);
        }}
      />

      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden
      >
        <div
          className="absolute -left-1/4 top-[-20%] h-[55%] w-[70%] rounded-full opacity-40 blur-3xl"
          style={{
            background: `radial-gradient(circle, color-mix(in oklch, ${accent} 55%, transparent), transparent 70%)`,
          }}
        />
        <div
          className="absolute -right-1/5 bottom-[-15%] h-[50%] w-[60%] rounded-full opacity-30 blur-3xl"
          style={{
            background: `radial-gradient(circle, color-mix(in oklch, ${accent} 40%, transparent), transparent 70%)`,
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
        transition={{
          duration: reducedMotion ? 0.01 : 0.34,
          ease: MOTION_EASE_OUT,
        }}
      >
        <header className="flex items-center justify-between gap-3 px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))] sm:px-7 sm:pt-6">
          <div className="flex items-center gap-2.5">
            <span
              className="flex size-9 items-center justify-center rounded-full"
              style={{
                background: `color-mix(in oklch, ${accent} 18%, transparent)`,
                color: accent,
              }}
            >
              <UserRound className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium tracking-tight">
                {t("brand")}
              </p>
              {showProgress ? (
                <p className="text-xs text-muted-foreground">
                  {t("stepOf", {
                    current: progressIndex + 1,
                    total: PERSONAL_ONBOARDING_PROGRESS_STEPS.length,
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
              {PERSONAL_ONBOARDING_PROGRESS_STEPS.map((key, i) => (
                <div
                  key={key}
                  className="h-1 flex-1 overflow-hidden rounded-full bg-muted"
                >
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: accent }}
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
              transition={{
                duration: reducedMotion ? 0.01 : 0.28,
                ease: MOTION_EASE_OUT,
              }}
            >
              {step === "welcome" ? (
                <StepShell
                  title={t("welcome.title")}
                  description={t("welcome.description")}
                >
                  <div className="flex items-start gap-3 rounded-2xl border border-border/50 bg-muted/20 px-4 py-3.5">
                    <Sparkles
                      className="mt-0.5 size-5 shrink-0"
                      style={{ color: accent }}
                    />
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {t("welcome.hint")}
                    </p>
                  </div>
                </StepShell>
              ) : null}

              {step === "language" ? (
                <StepShell
                  title={t("language.title")}
                  description={t("language.description")}
                >
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
                    {APP_LOCALES.map((code) => {
                      const active = draft.locale === code;
                      return (
                        <button
                          key={code}
                          type="button"
                          onClick={() =>
                            setDraft((d) => ({
                              ...d,
                              locale: normalizeAppLocale(code),
                            }))
                          }
                          className={cn(
                            "flex items-center gap-2.5 rounded-xl border px-3 py-3 text-left text-sm transition-colors",
                            active
                              ? "border-transparent text-foreground"
                              : "border-border/50 bg-card/60 text-muted-foreground hover:bg-muted/40",
                          )}
                          style={
                            active
                              ? {
                                  background: `color-mix(in oklch, ${accent} 14%, transparent)`,
                                  boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${accent} 45%, transparent)`,
                                }
                              : undefined
                          }
                        >
                          <Languages className="size-4 shrink-0 opacity-70" />
                          <span className="font-medium">
                            {APP_LOCALE_NATIVE_LABELS[code as AppLocale]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </StepShell>
              ) : null}

              {step === "identity" ? (
                <StepShell
                  title={t("identity.title")}
                  description={t("identity.description")}
                >
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="po-first">{t("identity.firstName")}</Label>
                      <Input
                        id="po-first"
                        value={draft.firstName}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            firstName: e.target.value,
                          }))
                        }
                        autoComplete="given-name"
                        className="h-11 rounded-xl"
                        placeholder={t("identity.firstNamePlaceholder")}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="po-last">{t("identity.lastName")}</Label>
                      <Input
                        id="po-last"
                        value={draft.lastName}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            lastName: e.target.value,
                          }))
                        }
                        autoComplete="family-name"
                        className="h-11 rounded-xl"
                        placeholder={t("identity.lastNamePlaceholder")}
                      />
                    </div>
                  </div>
                </StepShell>
              ) : null}

              {step === "contact" ? (
                <StepShell
                  title={t("contact.title")}
                  description={t("contact.description")}
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="po-phone">{t("contact.phone")}</Label>
                    <Input
                      id="po-phone"
                      type="tel"
                      value={draft.phone}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, phone: e.target.value }))
                      }
                      autoComplete="tel"
                      className="h-11 rounded-xl"
                      placeholder={t("contact.phonePlaceholder")}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("contact.phoneHint")}
                    </p>
                  </div>
                </StepShell>
              ) : null}

              {step === "done" ? (
                <StepShell
                  title={t("done.title")}
                  description={t("done.description", {
                    name: draft.firstName.trim() || t("brand"),
                  })}
                >
                  <div
                    className="flex size-16 items-center justify-center rounded-full"
                    style={{
                      background: `color-mix(in oklch, ${accent} 16%, transparent)`,
                      color: accent,
                    }}
                  >
                    <Check className="size-7" />
                  </div>
                </StepShell>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>

        <footer className="flex items-center gap-2 border-t border-border/40 px-5 py-4 sm:px-7">
          {step !== "welcome" && step !== "done" ? (
            <Button
              type="button"
              variant="outline"
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
          <Button
            type="button"
            size="lg"
            className={cn("ms-auto min-w-[8.5rem]", brandActionButtonRoundedClassName)}
            onClick={primaryAction}
            disabled={busy}
          >
            {busy
              ? t("saving")
              : step === "done"
                ? t("launch")
                : step === "contact"
                  ? t("finish")
                  : t("continue")}
            {step !== "done" && !busy ? (
              <ArrowRight className="size-4" />
            ) : null}
          </Button>
        </footer>
      </motion.div>
    </div>,
    document.body,
  );
}
