"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  formatSuperadminDate,
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
import { formatLocaleLabel } from "@/lib/constants/locale-labels";
import { fetchSuperadminUserProfile } from "@/lib/superadmin/superadmin-entity-profile-api";
import type { SuperadminUserProfileDetail } from "@/lib/superadmin/superadmin-entity-profile-types";
import type { SuperadminUserRow } from "@/lib/supabase/platform-superadmin-db";
import { EMPLOYEE_ROLE_OPTIONS } from "@/lib/types/employee-role";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";

function roleLabel(role: string): string {
  return EMPLOYEE_ROLE_OPTIONS.find((o) => o.value === role)?.label ?? role;
}

function displayName(row: SuperadminUserRow | null, detail: SuperadminUserProfileDetail | null): string {
  const gn = detail?.givenName ?? row?.given_name;
  const fn = detail?.familyName ?? row?.family_name;
  if (gn?.trim() || fn?.trim()) {
    return [gn, fn].filter(Boolean).join(" ");
  }
  return (
    detail?.displayName?.trim() ||
    row?.display_name?.trim() ||
    detail?.email ||
    row?.email ||
    "User"
  );
}

type Props = {
  user: SuperadminUserRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SuperadminUserProfileDrawer({
  user,
  open,
  onOpenChange,
}: Props) {
  const [detail, setDetail] = useState<SuperadminUserProfileDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const showSkeleton = useDeferredSkeleton(loading && !detail);

  useEffect(() => {
    if (!open || !user) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const res = await fetchSuperadminUserProfile(user.profile_id);
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
  }, [open, user]);

  const title = displayName(user, detail);
  const email = detail?.email ?? user?.email ?? null;
  const address = [
    detail?.addressLine1,
    [detail?.addressPostalCode, detail?.addressCity].filter(Boolean).join(" "),
    detail?.addressCountry,
  ]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(", ");

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent className={drawerContentClassName("formStaff")}>
        <DrawerHeader>
          <DrawerTitle>User-Profil</DrawerTitle>
          <DrawerDescription>
            Kontaktdaten, Aktivität und Restaurant-Mitgliedschaften.
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
                initials={initialsFromName(
                  detail?.givenName ?? user?.given_name,
                  detail?.familyName ?? user?.family_name,
                  email,
                )}
                title={title}
                subtitle={email}
                badges={
                  <>
                    {(detail?.isOnline ?? user?.is_online) ? (
                      <Badge
                        variant="outline"
                        className="border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                      >
                        Online
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Offline
                      </Badge>
                    )}
                    {detail?.isPlatformSuperadmin ? (
                      <Badge
                        variant="outline"
                        className="border-violet-500/40 bg-violet-500/10 text-violet-800 dark:text-violet-200"
                      >
                        Superadmin
                      </Badge>
                    ) : null}
                    {(detail?.locale ?? user?.locale) ? (
                      <Badge variant="outline" className="font-normal">
                        {formatLocaleLabel(detail?.locale ?? user?.locale ?? "")}
                      </Badge>
                    ) : null}
                  </>
                }
              />

              <SuperadminProfileSection title="Kontakt">
                <SuperadminProfileDetailRow label="Telefon">
                  {(detail?.phone ?? user?.phone)?.trim() || "—"}
                </SuperadminProfileDetailRow>
                {detail?.nickname?.trim() ? (
                  <SuperadminProfileDetailRow label="Spitzname">
                    {detail.nickname}
                  </SuperadminProfileDetailRow>
                ) : null}
                {detail?.birthDate ? (
                  <SuperadminProfileDetailRow label="Geburtstag">
                    {formatSuperadminDate(detail.birthDate)}
                  </SuperadminProfileDetailRow>
                ) : null}
                {address ? (
                  <SuperadminProfileDetailRow label="Adresse">
                    {address}
                  </SuperadminProfileDetailRow>
                ) : null}
              </SuperadminProfileSection>

              <SuperadminProfileSection title="Aktivität">
                <SuperadminProfileDetailRow label="Registriert">
                  {formatSuperadminDt(detail?.createdAt ?? user?.created_at)}
                </SuperadminProfileDetailRow>
                <SuperadminProfileDetailRow label="Letzter Login">
                  {formatSuperadminDt(
                    detail?.lastSignInAt ?? user?.last_sign_in_at,
                  )}
                </SuperadminProfileDetailRow>
                <SuperadminProfileDetailRow label="Zuletzt gesehen">
                  {formatSuperadminDt(detail?.lastSeenAt ?? user?.last_seen_at)}
                </SuperadminProfileDetailRow>
              </SuperadminProfileSection>

              <SuperadminProfileSection title="Restaurants">
                {(detail?.memberships?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Keine Restaurant-Mitgliedschaften.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {detail!.memberships.map((m) => (
                      <li
                        key={`${m.restaurantId}-${m.role}`}
                        className="flex items-start justify-between gap-3 rounded-lg border border-border/40 bg-background/60 px-2.5 py-2"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium">
                            {m.restaurantName}
                          </div>
                          <div className="truncate font-mono text-xs text-muted-foreground">
                            {m.restaurantSlug}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <Badge variant="outline" className="font-normal">
                            {roleLabel(m.role)}
                          </Badge>
                          {!m.isActive ? (
                            <span className="text-[11px] text-muted-foreground">
                              inaktiv
                            </span>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
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
