"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RestaurantTeamPanelSkeleton } from "@/components/settings/restaurant-team-panel-skeleton";
import { RestaurantPositionSelect } from "@/components/settings/restaurant-position-select";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Switch } from "@/components/ui/switch";
import { revokeStaffRestaurantAccessClient } from "@/lib/staff/staff-client-api";
import { formatLinkedProfileLabel } from "@/lib/staff/format-linked-profile-label";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useWorkspaceActiveRole } from "@/lib/hooks/use-workspace-active-role";
import {
  EMPLOYEE_ROLE_OPTIONS,
  type EmployeeRole,
  isRestaurantOwnerRole,
} from "@/lib/types/employee-role";
import {
  fetchRestaurantPositions,
  type RestaurantPositionRow,
} from "@/lib/supabase/restaurant-positions-db";
import { TagColorStripe } from "@/lib/ui/tag-color-stripe";
import { normalizeRestaurantPositionColor } from "@/lib/restaurant/restaurant-position-colors";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type ProfileJoin = {
  given_name: string | null;
  family_name: string | null;
  display_name: string | null;
};

type TeamMemberRow = {
  id: string;
  profileId: string;
  staffId: string | null;
  role: EmployeeRole;
  isActive: boolean;
  label: string;
};

export function RestaurantTeamPanel({ embedded = false }: { embedded?: boolean }) {
  const { restaurantId, role: myRole } = useWorkspaceActiveRole();
  const { has } = useRestaurantPermissions();
  const canManage = has("team.manage") || isRestaurantOwnerRole(myRole);
  const [rows, setRows] = useState<TeamMemberRow[]>([]);
  const [positions, setPositions] = useState<RestaurantPositionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<TeamMemberRow | null>(null);

  const load = useCallback(async () => {
    if (!restaurantId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const sb = createSupabaseBrowserClient();
    const [{ data, error }, { rows: positionRows }] = await Promise.all([
      sb
        .from("restaurant_employees")
        .select(
          "id, profile_id, staff_id, role, is_active, profiles(given_name, family_name, display_name)",
        )
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: true }),
      fetchRestaurantPositions(sb, restaurantId),
    ]);
    setPositions(
      positionRows.filter((p) =>
        EMPLOYEE_ROLE_OPTIONS.some((o) => o.value === p.slug),
      ),
    );
    if (error) {
      console.warn(error);
      toast.error(error.message);
      setRows([]);
    } else {
      const out: TeamMemberRow[] = [];
      for (const raw of data ?? []) {
        const prof = raw.profiles as ProfileJoin | ProfileJoin[] | null;
        const p = Array.isArray(prof) ? prof[0] : prof;
        const r = raw.role as EmployeeRole;
        out.push({
          id: raw.id as string,
          profileId: raw.profile_id as string,
          staffId: (raw.staff_id as string | null) ?? null,
          role: r,
          isActive: Boolean(raw.is_active),
          label: formatLinkedProfileLabel(p),
        });
      }
      setRows(out);
    }
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeOwnerCount = rows.filter((r) => r.role === "owner" && r.isActive)
    .length;

  const updateRole = async (row: TeamMemberRow, nextPositionId: string) => {
    const nextPosition = positions.find((p) => p.id === nextPositionId);
    const nextRole = nextPosition?.slug as EmployeeRole | undefined;
    if (!canManage || !nextRole || nextRole === row.role) return;
    setBusyId(row.id);
    try {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb
        .from("restaurant_employees")
        .update({ role: nextRole, position_id: nextPositionId })
        .eq("id", row.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Rolle aktualisiert.");
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const updateActive = async (row: TeamMemberRow, active: boolean) => {
    if (!canManage) return;
    setBusyId(row.id);
    try {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb
        .from("restaurant_employees")
        .update({ is_active: active })
        .eq("id", row.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(active ? "Mitglied reaktiviert." : "Mitglied deaktiviert.");
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const revokeAccess = async () => {
    if (!revokeTarget || !restaurantId) return;
    setBusyId(revokeTarget.id);
    const { profileLabel, error } = await revokeStaffRestaurantAccessClient({
      restaurantId,
      employeeId: revokeTarget.id,
      staffId: revokeTarget.staffId ?? undefined,
    });
    setBusyId(null);
    if (error) {
      const messages: Record<string, string> = {
        last_owner: "Der letzte aktive Inhaber kann nicht entfernt werden.",
        cannot_revoke_self: "Eigener Zugang kann hier nicht entzogen werden.",
        already_revoked: "Zugang ist bereits entzogen.",
      };
      toast.error(messages[error] ?? "Zugang konnte nicht entzogen werden.");
      return;
    }
    toast.success(
      profileLabel
        ? `App-Zugang für ${profileLabel} entzogen.`
        : "App-Zugang entzogen.",
    );
    setRevokeTarget(null);
    await load();
  };

  if (!restaurantId) {
    return (
      <p className="text-sm text-muted-foreground">
        Kein aktives Restaurant gesetzt. Bitte zuerst unter{" "}
        <Link className="text-primary underline" href="/workspace/restaurants">
          Meine Restaurants → Übersicht
        </Link>{" "}
        ein Restaurant auswählen.
      </p>
    );
  }

  const teamTable = (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-border text-left text-muted-foreground">
          <th className="py-3 pr-4 font-medium">Name</th>
          <th className="py-3 pr-4 font-medium">Rolle</th>
          <th className="w-[120px] py-3 text-center font-medium">Aktiv</th>
          {canManage ? (
            <th className="w-[140px] py-3 text-right font-medium">Zugang</th>
          ) : null}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const isOnlyActiveOwner =
            row.role === "owner" && row.isActive && activeOwnerCount === 1;
          const disabledRow = busyId === row.id;
          const roleLabel =
            EMPLOYEE_ROLE_OPTIONS.find((o) => o.value === row.role)?.label ??
            row.role;
          const rolePosition =
            positions.find((p) => p.slug === row.role) ?? null;
          const roleColor = rolePosition
            ? normalizeRestaurantPositionColor(rolePosition.color, rolePosition.id)
            : undefined;
          return (
            <tr key={row.id} className="border-b border-border/60">
              <td className="py-3 pr-4 font-medium">{row.label}</td>
              <td className="py-3 pr-4">
                {canManage ? (
                  <RestaurantPositionSelect
                    positions={positions}
                    value={rolePosition?.id ?? ""}
                    disabled={disabledRow || isOnlyActiveOwner}
                    aria-label={`Rolle für ${row.label}`}
                    onValueChange={(positionId) =>
                      void updateRole(row, positionId)
                    }
                  />
                ) : (
                  <Badge variant="outline" className="gap-1.5 capitalize">
                    <TagColorStripe
                      color={roleColor}
                      className="mr-0 h-4 shrink-0"
                    />
                    {roleLabel}
                  </Badge>
                )}
              </td>
              <td className="py-3 text-center">
                {canManage ? (
                  <Switch
                    checked={row.isActive}
                    disabled={disabledRow || isOnlyActiveOwner}
                    onCheckedChange={(v) => void updateActive(row, v === true)}
                    aria-label={`Aktiv für ${row.label}`}
                  />
                ) : row.isActive ? (
                  <Badge variant="secondary">Aktiv</Badge>
                ) : (
                  <Badge variant="outline">Inaktiv</Badge>
                )}
              </td>
              {canManage ? (
                <td className="py-3 text-right">
                  {row.isActive ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-lg border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={disabledRow || isOnlyActiveOwner}
                      onClick={() => setRevokeTarget(row)}
                    >
                      <LogOut className="size-4" />
                      Entziehen
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Entzogen
                    </span>
                  )}
                </td>
              ) : null}
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  return (
    <div className={embedded ? undefined : "space-y-6"}>
      {!embedded ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Mitglieder des{" "}
            <span className="font-medium text-foreground">aktuell aktiven</span>{" "}
            Restaurants. Wer die Berechtigung{" "}
            <span className="font-medium text-foreground">Team verwalten</span>{" "}
            hat, kann Rollen anpassen und Zugang entziehen. Es muss immer
            mindestens ein aktiver Inhaber existieren.
          </p>
          {!canManage ? (
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Du siehst die Liste schreibgeschützt.
            </p>
          ) : null}
        </div>
      ) : !canManage ? (
        <p className="mb-4 text-sm text-amber-800 dark:text-amber-200">
          Du siehst die Liste schreibgeschützt.
        </p>
      ) : null}

      {loading && !showSkeleton ? (
        <div className="min-h-[20rem]" aria-busy="true" />
      ) : null}
      {showSkeleton ? (
        <RestaurantTeamPanelSkeleton embedded={embedded} />
      ) : !embedded ? (
        <Card className="border-border/50 shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">Mitglieder</CardTitle>
            <CardDescription>
              {rows.length} Eintrag{rows.length === 1 ? "" : "e"}
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto px-4 sm:px-6">
            {teamTable}
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            {rows.length} Eintrag{rows.length === 1 ? "" : "e"}
          </p>
          <div className="overflow-x-auto">{teamTable}</div>
        </>
      )}

      <ConfirmDialog
        open={revokeTarget != null}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null);
        }}
        title="App-Zugang entziehen?"
        description={
          revokeTarget ? (
            <>
              <span className="font-medium text-foreground">
                {revokeTarget.label}
              </span>{" "}
              verliert den Zugang zu diesem Restaurant
              {revokeTarget.staffId
                ? " und kann im Mitarbeiter-Modul erneut eingeladen werden"
                : ""}
              .
            </>
          ) : null
        }
        confirmLabel="Zugang entziehen"
        destructive
        confirmDisabled={busyId != null}
        onConfirm={revokeAccess}
      />
    </div>
  );
}
