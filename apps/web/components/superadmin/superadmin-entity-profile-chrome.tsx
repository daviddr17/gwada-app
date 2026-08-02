"use client";

import type { ReactNode } from "react";
import { ProfileRoundAvatar } from "@/components/ui/profile-round-avatar";
import { cn } from "@/lib/utils";

export function SuperadminProfileHero({
  coverUrl,
  avatarUrl,
  initials,
  title,
  subtitle,
  badges,
  accentHex,
}: {
  coverUrl: string | null | undefined;
  avatarUrl: string | null | undefined;
  initials: string;
  title: string;
  subtitle?: string | null;
  badges?: ReactNode;
  accentHex?: string | null;
}) {
  const accent =
    accentHex && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(accentHex.trim())
      ? accentHex.trim()
      : null;

  return (
    <div className="overflow-hidden rounded-xl border border-border/50 bg-card shadow-card">
      <div
        className="relative h-28 w-full bg-gradient-to-br from-muted via-muted/70 to-background"
        style={
          coverUrl
            ? {
                backgroundImage: `url(${coverUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : accent
              ? {
                  backgroundImage: `linear-gradient(135deg, ${accent}40, transparent 55%)`,
                }
              : undefined
        }
      />
      <div className="relative px-4 pb-4 pt-0">
        <div className="-mt-8 flex items-end gap-3">
          <ProfileRoundAvatar
            src={avatarUrl}
            initials={initials}
            alt=""
            size="lg"
            className="size-16 min-h-16 min-w-16 border-2 border-card text-base shadow-sm"
          />
          <div className="min-w-0 flex-1 pb-0.5">
            <h3 className="truncate text-base font-semibold tracking-tight">
              {title}
            </h3>
            {subtitle ? (
              <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
        </div>
        {badges ? (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">{badges}</div>
        ) : null}
      </div>
    </div>
  );
}

export function SuperadminProfileDetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:gap-3">
      <dt className="w-32 shrink-0 text-xs text-muted-foreground sm:w-36">
        {label}
      </dt>
      <dd className="min-w-0 text-sm">{children}</dd>
    </div>
  );
}

export function SuperadminProfileSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      <dl className="space-y-2.5 rounded-xl border border-border/50 bg-muted/15 px-3 py-3">
        {children}
      </dl>
    </section>
  );
}

export function formatSuperadminDt(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function formatSuperadminDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("de-DE", { dateStyle: "medium" });
}

export function initialsFromName(
  first: string | null | undefined,
  last: string | null | undefined,
  fallback?: string | null,
): string {
  const a = (first ?? "").trim().slice(0, 1).toLocaleUpperCase("de-DE");
  const b = (last ?? "").trim().slice(0, 1).toLocaleUpperCase("de-DE");
  if (a && b) return a + b;
  if (a) return a;
  if (b) return b;
  const f = (fallback ?? "").trim();
  if (f.includes("@")) {
    return f.slice(0, 2).toLocaleUpperCase("de-DE") || "?";
  }
  const parts = f.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (
      parts[0]!.slice(0, 1).toLocaleUpperCase("de-DE") +
      parts[1]!.slice(0, 1).toLocaleUpperCase("de-DE")
    );
  }
  return f.slice(0, 2).toLocaleUpperCase("de-DE") || "?";
}
