"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useWorkspaceActiveRole } from "@/lib/hooks/use-workspace-active-role";
import {
  EMPLOYEE_ROLE_OPTIONS,
  type EmployeeRole,
  isRestaurantOwnerRole,
} from "@/lib/types/employee-role";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type ProfileJoin = {
  given_name: string | null;
  family_name: string | null;
  display_name: string | null;
};

type TeamMemberRow = {
  id: string;
  profileId: string;
  role: EmployeeRole;
  isActive: boolean;
  label: string;
};

function formatMemberLabel(p: ProfileJoin | null): string {
  if (!p) return "—";
  const gn = p.given_name?.trim() ?? "";
  const fn = p.family_name?.trim() ?? "";
  if (gn || fn) return [gn, fn].filter(Boolean).join(" ");
  const d = p.display_name?.trim();
  return d || "—";
}

export default function WorkspaceTeamPage() {
  const { restaurantId, role: myRole } = useWorkspaceActiveRole();
  const canManage = isRestaurantOwnerRole(myRole);
  const [rows, setRows] = useState<TeamMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!restaurantId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const sb = createSupabaseBrowserClient();
    const { data, error } = await sb
      .from("restaurant_employees")
      .select(
        "id, profile_id, role, is_active, profiles(given_name, family_name, display_name)",
      )
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: true });
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
          role: r,
          isActive: Boolean(raw.is_active),
          label: formatMemberLabel(p),
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

  const updateRole = async (row: TeamMemberRow, nextRole: EmployeeRole) => {
    if (!canManage || nextRole === row.role) return;
    setBusyId(row.id);
    try {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb
        .from("restaurant_employees")
        .update({ role: nextRole })
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

  if (!restaurantId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="text-muted-foreground">
          Kein aktives Restaurant gesetzt. Bitte zuerst unter{" "}
          <Link className="text-primary underline" href="/workspace/restaurants">
            Restaurants
          </Link>{" "}
          ein Restaurant auswählen.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="text-muted-foreground">
          Mitglieder des{" "}
          <span className="font-medium text-foreground">aktuell aktiven</span>{" "}
          Restaurants. Als Inhaber kannst du Rollen und Zugriffe anpassen. Es
          muss immer mindestens ein aktiver Inhaber (
          <code className="rounded bg-muted px-1 py-0.5 text-xs">owner</code>)
          existieren.
        </p>
        {!canManage ? (
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Nur Inhaber dürfen Teamrollen bearbeiten. Du siehst die Liste
            schreibgeschützt.
          </p>
        ) : null}
      </header>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          <span>Lade Team…</span>
        </div>
      ) : (
        <Card className="border-border/50 shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">Mitglieder</CardTitle>
            <CardDescription>
              {rows.length} Eintrag{rows.length === 1 ? "" : "e"}
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto px-4 sm:px-6">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-3 pr-4 font-medium">Name</th>
                  <th className="py-3 pr-4 font-medium">Rolle</th>
                  <th className="w-[120px] py-3 text-center font-medium">Aktiv</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const isOnlyActiveOwner =
                    row.role === "owner" &&
                    row.isActive &&
                    activeOwnerCount === 1;
                  const disabledRow = busyId === row.id;
                  return (
                    <tr key={row.id} className="border-b border-border/60">
                      <td className="py-3 pr-4 font-medium">{row.label}</td>
                      <td className="py-3 pr-4">
                        {canManage ? (
                          <select
                            className="h-9 max-w-[200px] rounded-lg border border-input bg-background px-2 text-sm"
                            value={row.role}
                            disabled={disabledRow || isOnlyActiveOwner}
                            aria-label={`Rolle für ${row.label}`}
                            onChange={(e) =>
                              void updateRole(
                                row,
                                e.target.value as EmployeeRole,
                              )
                            }
                          >
                            {EMPLOYEE_ROLE_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Badge variant="outline" className="capitalize">
                            {row.role}
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 text-center">
                        {canManage ? (
                          <Switch
                            checked={row.isActive}
                            disabled={disabledRow || isOnlyActiveOwner}
                            onCheckedChange={(v) =>
                              void updateActive(row, v === true)
                            }
                            aria-label={`Aktiv für ${row.label}`}
                          />
                        ) : row.isActive ? (
                          <Badge variant="secondary">Aktiv</Badge>
                        ) : (
                          <Badge variant="outline">Inaktiv</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
