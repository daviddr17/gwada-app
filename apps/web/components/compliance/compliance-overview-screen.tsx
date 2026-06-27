"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ClipboardCheck,
  Download,
  FileDown,
  Refrigerator,
  ScrollText,
  Thermometer,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ComplianceCategoryBadge } from "@/components/compliance/compliance-category-badge";
import {
  fetchComplianceChecklists,
  fetchComplianceDevices,
  fetchComplianceRecords,
  fetchComplianceSettings,
  seedDefaultComplianceTemplates,
} from "@/lib/supabase/compliance-db";
import { listDueComplianceChecklists } from "@/lib/compliance/compliance-due";
import {
  downloadComplianceRecordsPdf,
} from "@/lib/compliance/export-compliance";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { useRestaurantProfile } from "@/lib/contexts/restaurant-profile-context";
import {
  hasModuleCreate,
  hasModuleRead,
} from "@/lib/permissions/module-crud-permissions";
import { ModuleAccessDenied } from "@/lib/permissions/module-access-denied";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { modulePrimaryAddButtonFullWidthClassName } from "@/lib/ui/module-primary-add-button";
import type { RestaurantComplianceChecklistRow } from "@/lib/types/compliance";
import { COMPLIANCE_FREQUENCY_LABELS } from "@/lib/types/compliance";
import { CHECKLISTEN_ROUTES } from "@/lib/navigation/checklisten-routes";

export function ComplianceOverviewScreen({
  variant = "full",
}: {
  /** `section`: ohne Überschrift, für eingebettete Modul-Übersicht. */
  variant?: "full" | "section";
}) {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const { profile: restaurantProfile } = useRestaurantProfile();
  const { has, loading: permissionsLoading } = useRestaurantPermissions();
  const canRead = hasModuleRead(has, "compliance");
  const canCreate = hasModuleCreate(has, "compliance");

  const [checklists, setChecklists] = useState<RestaurantComplianceChecklistRow[]>(
    [],
  );
  const [deviceCount, setDeviceCount] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [showDueReminders, setShowDueReminders] = useState(true);
  const [records, setRecords] = useState<
    Awaited<ReturnType<typeof fetchComplianceRecords>>["data"]
  >([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const reload = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    const [cl, dev, rec, settings] = await Promise.all([
      fetchComplianceChecklists(restaurantId),
      fetchComplianceDevices(restaurantId),
      fetchComplianceRecords(restaurantId, { limit: 500 }),
      fetchComplianceSettings(restaurantId),
    ]);
    setLoading(false);
    if (cl.error) toast.error(cl.error);
    else setChecklists(cl.data);

    if (!dev.error) setDeviceCount(dev.data.length);

    if (!rec.error) {
      setRecords(rec.data);
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const count = rec.data.filter(
        (r) => new Date(r.performed_at) >= start,
      ).length;
      setTodayCount(count);
    }

    if (!settings.error) {
      setShowDueReminders(settings.data?.show_due_reminders ?? true);
    }
  }, [restaurantId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const dueChecklists = useMemo(() => {
    const lastByChecklist = new Map<string, string>();
    for (const r of records) {
      if (!lastByChecklist.has(r.checklist_id)) {
        lastByChecklist.set(r.checklist_id, r.performed_at);
      }
    }
    const enriched = checklists
      .filter((c) => c.is_active)
      .map((c) => ({
        ...c,
        last_performed_at: lastByChecklist.get(c.id) ?? null,
      }));
    return listDueComplianceChecklists(enriched);
  }, [checklists, records]);

  const seedTemplates = async () => {
    if (!restaurantId) return;
    setSeeding(true);
    const { created, error } = await seedDefaultComplianceTemplates(restaurantId);
    setSeeding(false);
    if (error) toast.error(error);
    else if (created === 0) toast.message("Es existieren bereits Vorlagen.");
    else {
      toast.success(`${created} Standardvorlagen angelegt.`);
      void reload();
    }
  };

  if (!permissionsLoading && !canRead) {
    if (variant === "section") return null;
    return <ModuleAccessDenied label="Eigenkontrolle" />;
  }
  if (!workspaceReady) return <WorkspaceRestaurantResolvePlaceholder />;
  if (!restaurantId) return <WorkspaceRestaurantMissingMessage />;

  const activeChecklists = checklists.filter((c) => c.is_active);

  const exportPdf = async () => {
    if (records.length === 0) return;
    setExportingPdf(true);
    try {
      await downloadComplianceRecordsPdf(records, {
        restaurantName: restaurantProfile?.name ?? undefined,
      });
    } catch {
      toast.error("PDF-Export fehlgeschlagen.");
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className={variant === "section" ? "space-y-6" : "space-y-6 pb-4"}>
      {variant === "full" ? (
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Eigenkontrolle</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            HACCP-konforme Checklisten für Temperatur, Reinigung, Wareneingang und
            weitere Kontrollen — erfassbar am Display und im Protokoll nachvollziehbar.
          </p>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-border/50 shadow-card">
          <CardHeader className="pb-2">
            <CardDescription>Aktive Vorlagen</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {loading ? "—" : activeChecklists.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-border/50 shadow-card">
          <CardHeader className="pb-2">
            <CardDescription>Kühlgeräte</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {loading ? "—" : deviceCount}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-border/50 shadow-card">
          <CardHeader className="pb-2">
            <CardDescription>Einträge heute</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {loading ? "—" : todayCount}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {showDueReminders && dueChecklists.length > 0 ? (
        <Card className="border-amber-500/30 bg-amber-500/5 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="size-5 text-amber-600" />
              Heute noch offen ({dueChecklists.length})
            </CardTitle>
            <CardDescription>
              Diese Vorlagen sind für die aktuelle Periode noch nicht erfasst worden.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {dueChecklists.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/40 bg-background/60 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {COMPLIANCE_FREQUENCY_LABELS[c.frequency]}
                  </p>
                </div>
                <ComplianceCategoryBadge category={c.category} />
              </div>
            ))}
            <div className="flex flex-wrap gap-2 pt-2">
              <Link
                href={CHECKLISTEN_ROUTES.eintraege}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-input bg-background px-4 text-sm font-medium hover:bg-muted/40"
              >
                Jetzt erfassen
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {records.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            disabled={exportingPdf}
            onClick={() => void exportPdf()}
          >
            <FileDown className="size-4" />
            {exportingPdf ? "Export …" : "Einträge als PDF"}
          </Button>
        </div>
      ) : null}

      {canCreate && checklists.length === 0 ? (
        <Card className="border-border/50 shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">Standardvorlagen importieren</CardTitle>
            <CardDescription>
              Legt Vorlagen aus der Plattform-Bibliothek an (Superadmin →
              Vorlagen → Checklisten-Vorlagen) — Temperatur, Reinigung,
              Wareneingang und weitere HACCP-Checklisten.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              size="lg"
              className={modulePrimaryAddButtonFullWidthClassName}
              disabled={seeding}
              onClick={() => void seedTemplates()}
            >
              <Download className="size-4" />
              {seeding ? "Importiere …" : "Standardvorlagen importieren"}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link href={CHECKLISTEN_ROUTES.vorlagen} className="block">
          <Card className="h-full border-border/50 shadow-card transition-colors hover:bg-muted/20">
            <CardHeader>
              <ClipboardCheck className="mb-1 size-5 text-muted-foreground" />
              <CardTitle className="text-base">Vorlagen</CardTitle>
              <CardDescription>Checklisten anlegen und pflegen</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href={CHECKLISTEN_ROUTES.geraete} className="block">
          <Card className="h-full border-border/50 shadow-card transition-colors hover:bg-muted/20">
            <CardHeader>
              <Refrigerator className="mb-1 size-5 text-muted-foreground" />
              <CardTitle className="text-base">Geräte</CardTitle>
              <CardDescription>Kühlschränke, Truhen, Soll-Temperaturen</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href={CHECKLISTEN_ROUTES.eintraege} className="block">
          <Card className="h-full border-border/50 shadow-card transition-colors hover:bg-muted/20">
            <CardHeader>
              <Thermometer className="mb-1 size-5 text-muted-foreground" />
              <CardTitle className="text-base">Einträge</CardTitle>
              <CardDescription>Erfasste Kontrollen ansehen</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href={CHECKLISTEN_ROUTES.protokoll} className="block">
          <Card className="h-full border-border/50 shadow-card transition-colors hover:bg-muted/20">
            <CardHeader>
              <ScrollText className="mb-1 size-5 text-muted-foreground" />
              <CardTitle className="text-base">Protokoll</CardTitle>
              <CardDescription>Änderungen und Nachweise</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>

      {activeChecklists.length > 0 ? (
        <Card className="border-border/50 shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">Aktive Vorlagen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {activeChecklists.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/40 bg-muted/10 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {COMPLIANCE_FREQUENCY_LABELS[c.frequency]}
                    {c.show_on_display ? " · Display" : ""}
                  </p>
                </div>
                <ComplianceCategoryBadge category={c.category} />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
