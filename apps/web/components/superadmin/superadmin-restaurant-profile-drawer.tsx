"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  formatSuperadminDt,
  initialsFromName,
  SuperadminProfileDetailRow,
  SuperadminProfileHero,
  SuperadminProfileSection,
} from "@/components/superadmin/superadmin-entity-profile-chrome";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import {
  billingPlanLabel,
  billingSourceLabel,
  billingStatusLabel,
} from "@/lib/billing/billing-status-labels";
import { formatRestaurantTimezoneLabel } from "@/lib/restaurant/restaurant-timezone";
import { fetchSuperadminRestaurantProfile } from "@/lib/superadmin/superadmin-entity-profile-api";
import type { SuperadminRestaurantProfileDetail } from "@/lib/superadmin/superadmin-entity-profile-types";
import type { SuperadminRestaurantRow } from "@/lib/supabase/platform-superadmin-db";
import { EMPLOYEE_ROLE_OPTIONS } from "@/lib/types/employee-role";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";

function roleLabel(role: string): string {
  return EMPLOYEE_ROLE_OPTIONS.find((o) => o.value === role)?.label ?? role;
}

function formatAddress(detail: SuperadminRestaurantProfileDetail | null): string {
  if (!detail) return "";
  return [
    detail.addressLine1,
    detail.addressLine2,
    [detail.postalCode, detail.city].filter(Boolean).join(" "),
    detail.country,
  ]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(", ");
}

type Props = {
  restaurant: SuperadminRestaurantRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SuperadminRestaurantProfileDrawer({
  restaurant,
  open,
  onOpenChange,
}: Props) {
  const [detail, setDetail] =
    useState<SuperadminRestaurantProfileDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const showSkeleton = useDeferredSkeleton(loading && !detail);

  useEffect(() => {
    if (!open || !restaurant) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const res = await fetchSuperadminRestaurantProfile(restaurant.id);
      if (cancelled) return;
      if (res.error) {
        toast.error(res.error);
        setDetail(null);
      } else {
        setDetail(res.detail ?? null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, restaurant]);

  const name = detail?.name ?? restaurant?.name ?? "Restaurant";
  const slug = detail?.slug ?? restaurant?.slug ?? "";
  const planId = detail?.planId ?? restaurant?.plan_id ?? "free";
  const planStatus = detail?.planStatus ?? restaurant?.plan_status ?? "active";
  const planSource = detail?.planSource ?? restaurant?.plan_source ?? "manual";
  const hasPos = detail?.hasPosAddon ?? Boolean(restaurant?.has_pos_addon);
  const isPublished = detail?.isPublished ?? Boolean(restaurant?.is_published);
  const address = formatAddress(detail);

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent className={drawerContentClassName("formStaff")}>
        <DrawerHeader>
          <DrawerTitle>Restaurant-Profil</DrawerTitle>
          <DrawerDescription>
            Stammdaten, Abo und Team auf einen Blick.
          </DrawerDescription>
        </DrawerHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-2">
          {showSkeleton ? (
            <div className="space-y-3" aria-busy>
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          ) : (
            <>
              <SuperadminProfileHero
                coverUrl={detail?.coverUrl}
                avatarUrl={detail?.avatarUrl}
                initials={initialsFromName(null, null, name)}
                title={name}
                subtitle={slug ? `/${slug}` : null}
                accentHex={detail?.brandAccentHex ?? restaurant?.brand_accent_hex}
                badges={
                  <>
                    {isPublished ? (
                      <Badge
                        variant="outline"
                        className="border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                      >
                        Live
                      </Badge>
                    ) : (
                      <Badge variant="outline">Entwurf</Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={
                        planId === "pro"
                          ? "border-violet-500/40 bg-violet-500/10 text-violet-800 dark:text-violet-200"
                          : planId === "basic"
                            ? "border-sky-500/40 bg-sky-500/10 text-sky-800 dark:text-sky-200"
                            : undefined
                      }
                    >
                      {billingPlanLabel(planId)}
                    </Badge>
                    {hasPos ? <Badge variant="outline">POS</Badge> : null}
                  </>
                }
              />

              {detail?.description?.trim() ? (
                <p className="rounded-xl border border-border/50 bg-muted/15 px-3 py-2.5 text-sm text-muted-foreground">
                  {detail.description.trim()}
                </p>
              ) : null}

              <SuperadminProfileSection title="Kontakt & Standort">
                <SuperadminProfileDetailRow label="E-Mail">
                  {(detail?.email ?? restaurant?.email)?.trim() || "—"}
                </SuperadminProfileDetailRow>
                <SuperadminProfileDetailRow label="Telefon">
                  {(detail?.phone ?? restaurant?.phone)?.trim() || "—"}
                </SuperadminProfileDetailRow>
                <SuperadminProfileDetailRow label="Website">
                  {detail?.website?.trim() || "—"}
                </SuperadminProfileDetailRow>
                <SuperadminProfileDetailRow label="Social">
                  {detail?.socialHandle?.trim() || "—"}
                </SuperadminProfileDetailRow>
                <SuperadminProfileDetailRow label="Adresse">
                  {address || "—"}
                </SuperadminProfileDetailRow>
                <SuperadminProfileDetailRow label="Zeitzone">
                  {formatRestaurantTimezoneLabel(
                    detail?.timezone ?? restaurant?.timezone ?? "",
                  )}
                </SuperadminProfileDetailRow>
              </SuperadminProfileSection>

              <SuperadminProfileSection title="Owner & Rechtliches">
                <SuperadminProfileDetailRow label="Owner">
                  <div>
                    <div>
                      {detail?.ownerDisplayName?.trim() ||
                        restaurant?.owner_display_name?.trim() ||
                        "—"}
                    </div>
                    {(detail?.ownerEmail || restaurant?.owner_email) && (
                      <div className="text-xs text-muted-foreground">
                        {detail?.ownerEmail ?? restaurant?.owner_email}
                      </div>
                    )}
                  </div>
                </SuperadminProfileDetailRow>
                <SuperadminProfileDetailRow label="Firma">
                  {detail?.legalName?.trim() || "—"}
                </SuperadminProfileDetailRow>
                <SuperadminProfileDetailRow label="USt-IdNr.">
                  {detail?.vatNumber?.trim() || "—"}
                </SuperadminProfileDetailRow>
                <SuperadminProfileDetailRow label="Angelegt">
                  {formatSuperadminDt(detail?.createdAt ?? restaurant?.created_at)}
                </SuperadminProfileDetailRow>
              </SuperadminProfileSection>

              <SuperadminProfileSection title="Abo">
                <SuperadminProfileDetailRow label="Plan">
                  {billingPlanLabel(planId)}
                  {detail?.planInterval || restaurant?.plan_interval
                    ? ` · ${detail?.planInterval ?? restaurant?.plan_interval}`
                    : ""}
                </SuperadminProfileDetailRow>
                <SuperadminProfileDetailRow label="Status">
                  {billingStatusLabel(planStatus)}
                </SuperadminProfileDetailRow>
                <SuperadminProfileDetailRow label="Quelle">
                  {billingSourceLabel(planSource)}
                </SuperadminProfileDetailRow>
                <SuperadminProfileDetailRow label="POS">
                  {hasPos ? "Aktiv" : "Nein"}
                </SuperadminProfileDetailRow>
              </SuperadminProfileSection>

              <SuperadminProfileSection title="Team">
                <SuperadminProfileDetailRow label="Mitglieder">
                  {detail?.employeeCount ?? restaurant?.employee_count ?? 0}
                </SuperadminProfileDetailRow>
                {(detail?.team?.length ?? 0) > 0 ? (
                  <ul className="mt-1 space-y-2">
                    {detail!.team.map((m) => (
                      <li
                        key={`${m.profileId}-${m.role}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-background/60 px-2.5 py-2"
                      >
                        <span className="truncate font-medium">
                          {m.displayName}
                        </span>
                        <Badge variant="outline" className="shrink-0 font-normal">
                          {roleLabel(m.role)}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Keine aktiven Teammitglieder geladen.
                  </p>
                )}
              </SuperadminProfileSection>
            </>
          )}
        </div>

        <DrawerFooter className="gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            Schließen
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
