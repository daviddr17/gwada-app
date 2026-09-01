"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { DisplayRoundAvatar } from "@/components/display/display-round-avatar";
import { displayPersonInitials } from "@/lib/display/display-avatar-utils";
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";
import type { DisplayStaffProfilePayload } from "@/lib/display/display-profile-types";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { staffDisplayName } from "@/lib/types/staff";
import { cn } from "@/lib/utils";

function formatBirthDate(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parsed);
}

function ProfileField({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 space-y-1", className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-sm text-foreground">{value || "—"}</p>
    </div>
  );
}

function StammdatenSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <SkeletonCardFrame className="flex items-center gap-4 p-4">
        <Skeleton className="size-16 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-6 w-48 max-w-full rounded-md" />
          <Skeleton className="h-4 w-32 max-w-full rounded-md" />
        </div>
      </SkeletonCardFrame>
      <SkeletonCardFrame className="space-y-4 p-4">
        <Skeleton className="h-4 w-full rounded-md" />
        <Skeleton className="h-4 w-5/6 rounded-md" />
        <Skeleton className="h-4 w-2/3 rounded-md" />
      </SkeletonCardFrame>
    </div>
  );
}

export function DisplayProfileStammdatenPanel() {
  const [profile, setProfile] = useState<DisplayStaffProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/display/profile", { credentials: "include" });
      const json = (await res.json()) as {
        profile?: DisplayStaffProfilePayload;
        error?: string;
      };
      if (!res.ok) {
        toast.error(json.error ?? "Profil konnte nicht geladen werden");
        setProfile(null);
      } else {
        setProfile(json.profile ?? null);
      }
    } catch {
      toast.error("Profil konnte nicht geladen werden");
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (loading && showSkeleton) return <StammdatenSkeleton />;
  if (loading) return <div className="min-h-[12rem]" aria-busy="true" />;
  if (!profile) {
    return (
      <p className="rounded-xl border border-border/50 bg-muted/15 px-4 py-8 text-center text-sm text-muted-foreground">
        Profildaten konnten nicht geladen werden.
      </p>
    );
  }

  const name = staffDisplayName(profile);
  const addressLine = [profile.address_line1, profile.address_line2]
    .filter(Boolean)
    .join(", ");
  const cityLine = [profile.postal_code, profile.city].filter(Boolean).join(" ");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 rounded-xl border border-border/50 bg-card p-4 shadow-card">
        <DisplayRoundAvatar
          src={profile.avatar_url}
          initials={displayPersonInitials(profile.given_name, profile.family_name)}
          alt={name}
          size="lg"
          className="shrink-0"
        />
        <div className="min-w-0">
          <p className="truncate text-xl font-semibold">{name}</p>
          {profile.position_name ? (
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {profile.position_name}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 rounded-xl border border-border/50 bg-card p-4 shadow-card sm:grid-cols-2">
        <ProfileField label="E-Mail" value={profile.email?.trim() ?? ""} />
        <ProfileField label="Telefon" value={profile.phone?.trim() ?? ""} />
        <ProfileField
          label="Geburtsdatum"
          value={formatBirthDate(profile.birth_date)}
        />
        <ProfileField
          label="Nationalität"
          value={profile.nationality?.trim() ?? ""}
        />
        <ProfileField
          label="Adresse"
          value={addressLine}
          className="sm:col-span-2"
        />
        <ProfileField
          label="Ort"
          value={[cityLine, profile.country?.trim()].filter(Boolean).join(", ")}
          className="sm:col-span-2"
        />
      </div>
    </div>
  );
}
