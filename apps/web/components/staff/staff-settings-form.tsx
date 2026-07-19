"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SettingsStickySaveBar,
  settingsAccentSaveButtonClassName,
} from "@/components/settings/settings-sticky-save-bar";
import { useDocumentTagsStorage } from "@/lib/hooks/use-document-tags-storage";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import {
  DISPLAY_AUTO_CLOCK_OUT_HOURS_DEFAULT,
  DISPLAY_AUTO_CLOCK_OUT_HOURS_MAX,
  DISPLAY_AUTO_CLOCK_OUT_HOURS_MIN,
} from "@/lib/staff/staff-display-auto-clock-out";
import {
  fetchStaffModuleSettings,
  STAFF_CONTRACT_DEFAULT_DOCUMENT_TAG_NAME,
  upsertStaffModuleSettings,
} from "@/lib/supabase/staff-module-settings-db";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { cn } from "@/lib/utils";
import { GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT } from "@/lib/supabase/workspace-persistence";
import { StaffContractPlatformImportDrawer } from "@/components/staff/staff-contract-platform-import-drawer";
import { modulePrimaryAddButtonFullWidthClassName } from "@/lib/ui/module-primary-add-button";

const NONE_TAG_VALUE = "__none__";

type SettingsSnapshot = {
  contractDocumentTagId: string | null;
  profileShowWorkHours: boolean;
  profileShowShiftPlan: boolean;
  profileShowDocuments: boolean;
  profileShowAvailability: boolean;
  profileAllowDisplayPinSelfService: boolean;
  contractTwoStepSigning: boolean;
  displayAutoClockOutEnabled: boolean;
  displayAutoClockOutHours: string;
};

export function StaffSettingsForm() {
  const { restaurantId, supabaseEnvOk, ready: workspaceReady } =
    useWorkspaceRestaurantUuid();
  const { items: documentTags } = useDocumentTagsStorage(restaurantId);
  const [contractDocumentTagId, setContractDocumentTagId] = useState<
    string | null
  >(null);
  const [profileShowWorkHours, setProfileShowWorkHours] = useState(true);
  const [profileShowShiftPlan, setProfileShowShiftPlan] = useState(true);
  const [profileShowDocuments, setProfileShowDocuments] = useState(true);
  const [profileShowAvailability, setProfileShowAvailability] = useState(true);
  const [profileAllowDisplayPinSelfService, setProfileAllowDisplayPinSelfService] =
    useState(false);
  const [contractTwoStepSigning, setContractTwoStepSigning] = useState(false);
  const [displayAutoClockOutEnabled, setDisplayAutoClockOutEnabled] =
    useState(true);
  const [displayAutoClockOutHours, setDisplayAutoClockOutHours] = useState(
    String(DISPLAY_AUTO_CLOCK_OUT_HOURS_DEFAULT),
  );
  const [platformImportOpen, setPlatformImportOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const savedRef = useRef<string | null>(null);

  const snapshot = useMemo(
    (): SettingsSnapshot => ({
      contractDocumentTagId,
      profileShowWorkHours,
      profileShowShiftPlan,
      profileShowDocuments,
      profileShowAvailability,
      profileAllowDisplayPinSelfService,
      contractTwoStepSigning,
      displayAutoClockOutEnabled,
      displayAutoClockOutHours,
    }),
    [
      contractDocumentTagId,
      profileShowWorkHours,
      profileShowShiftPlan,
      profileShowDocuments,
      profileShowAvailability,
      profileAllowDisplayPinSelfService,
      contractTwoStepSigning,
      displayAutoClockOutEnabled,
      displayAutoClockOutHours,
    ],
  );

  const snapshotJson = useMemo(() => JSON.stringify(snapshot), [snapshot]);

  const dirty =
    savedRef.current !== null && !loading && snapshotJson !== savedRef.current;

  const applyLoaded = (next: SettingsSnapshot) => {
    setContractDocumentTagId(next.contractDocumentTagId);
    setProfileShowWorkHours(next.profileShowWorkHours);
    setProfileShowShiftPlan(next.profileShowShiftPlan);
    setProfileShowDocuments(next.profileShowDocuments);
    setProfileShowAvailability(next.profileShowAvailability);
    setProfileAllowDisplayPinSelfService(next.profileAllowDisplayPinSelfService);
    setContractTwoStepSigning(next.contractTwoStepSigning);
    setDisplayAutoClockOutEnabled(next.displayAutoClockOutEnabled);
    setDisplayAutoClockOutHours(next.displayAutoClockOutHours);
    savedRef.current = JSON.stringify(next);
  };

  useEffect(() => {
    if (!restaurantId) return;
    let cancel = false;
    setLoading(true);
    savedRef.current = null;
    void (async () => {
      const { data, error } = await fetchStaffModuleSettings(restaurantId);
      if (cancel) return;
      setLoading(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      applyLoaded({
        contractDocumentTagId: data?.contract_document_tag_id ?? null,
        profileShowWorkHours: data?.profile_show_work_hours ?? true,
        profileShowShiftPlan: data?.profile_show_shift_plan ?? true,
        profileShowDocuments: data?.profile_show_documents ?? true,
        profileShowAvailability: data?.profile_show_availability ?? true,
        profileAllowDisplayPinSelfService:
          data?.profile_allow_display_pin_self_service ?? false,
        contractTwoStepSigning: data?.contract_two_step_signing ?? false,
        displayAutoClockOutEnabled:
          data?.display_auto_clock_out_enabled !== false,
        displayAutoClockOutHours: String(
          data?.display_auto_clock_out_hours ??
            DISPLAY_AUTO_CLOCK_OUT_HOURS_DEFAULT,
        ),
      });
    })();
    return () => {
      cancel = true;
    };
  }, [restaurantId]);

  const save = () => {
    if (!restaurantId) return;
    const hours = Number.parseInt(displayAutoClockOutHours.trim(), 10);
    if (
      displayAutoClockOutEnabled &&
      (!Number.isFinite(hours) ||
        hours < DISPLAY_AUTO_CLOCK_OUT_HOURS_MIN ||
        hours > DISPLAY_AUTO_CLOCK_OUT_HOURS_MAX)
    ) {
      toast.error(
        `Auto-Abmeldung: ${DISPLAY_AUTO_CLOCK_OUT_HOURS_MIN}–${DISPLAY_AUTO_CLOCK_OUT_HOURS_MAX} Stunden.`,
      );
      return;
    }
    setSaving(true);
    void (async () => {
      const { error } = await upsertStaffModuleSettings({
        restaurantId,
        contractDocumentTagId,
        profileShowWorkHours,
        profileShowShiftPlan,
        profileShowDocuments,
        profileShowAvailability,
        profileAllowDisplayPinSelfService,
        contractTwoStepSigning,
        displayAutoClockOutEnabled,
        displayAutoClockOutHours: Number.isFinite(hours)
          ? hours
          : DISPLAY_AUTO_CLOCK_OUT_HOURS_DEFAULT,
      });
      setSaving(false);
      if (error) toast.error(error.message);
      else {
        toast.success("Einstellungen gespeichert.");
        savedRef.current = snapshotJson;
        window.dispatchEvent(
          new Event(GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT),
        );
      }
    })();
  };

  if (!supabaseEnvOk) {
    return (
      <p className="text-sm text-muted-foreground">
        Supabase-Umgebungsvariablen fehlen.
      </p>
    );
  }

  if (!workspaceReady) {
    return <WorkspaceRestaurantResolvePlaceholder />;
  }

  if (!restaurantId) {
    return <WorkspaceRestaurantMissingMessage />;
  }

  const activeTags = documentTags.filter((t) => t.active);

  return (
    <div className="pb-4">
      <form
        className="contents"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="space-y-6">
          <Card className="border-border/50 shadow-card">
          <CardHeader className="gap-2">
            <CardTitle className="text-xl">Profil (Self-Service)</CardTitle>
            <CardDescription>
              Steuert, welche Bereiche verknüpfte Mitarbeiter unter Profil
              sehen. Übersicht, Anmeldung und Benachrichtigungen bleiben immer
              sichtbar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between gap-4 rounded-xl border border-border/40 bg-muted/15 p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Meine Arbeitszeiten</p>
                <p className="text-xs text-muted-foreground">
                  Eigene erfasste Zeiten und Abwesenheiten im Profil.
                </p>
              </div>
              <Switch
                checked={profileShowWorkHours}
                onCheckedChange={setProfileShowWorkHours}
                disabled={loading}
                aria-label="Meine Arbeitszeiten im Profil anzeigen"
              />
            </div>
            <div className="flex items-start justify-between gap-4 rounded-xl border border-border/40 bg-muted/15 p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Dienstplan</p>
                <p className="text-xs text-muted-foreground">
                  Geplante Schichten des Mitarbeiters im Profil.
                </p>
              </div>
              <Switch
                checked={profileShowShiftPlan}
                onCheckedChange={setProfileShowShiftPlan}
                disabled={loading}
                aria-label="Dienstplan im Profil anzeigen"
              />
            </div>
            <div className="flex items-start justify-between gap-4 rounded-xl border border-border/40 bg-muted/15 p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Meine Dokumente</p>
                <p className="text-xs text-muted-foreground">
                  Vertrags-PDFs und hochgeladene personalbezogene Dokumente.
                </p>
              </div>
              <Switch
                checked={profileShowDocuments}
                onCheckedChange={setProfileShowDocuments}
                disabled={loading}
                aria-label="Meine Dokumente im Profil anzeigen"
              />
            </div>
            <div className="flex items-start justify-between gap-4 rounded-xl border border-border/40 bg-muted/15 p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Verfügbarkeit</p>
                <p className="text-xs text-muted-foreground">
                  Eigene Verfügbarkeitszeiten im Profil pflegen (für
                  Schichtplanung).
                </p>
              </div>
              <Switch
                checked={profileShowAvailability}
                onCheckedChange={setProfileShowAvailability}
                disabled={loading}
                aria-label="Verfügbarkeit im Profil anzeigen"
              />
            </div>
            <div className="flex items-start justify-between gap-4 rounded-xl border border-border/40 bg-muted/15 p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Display-PIN (Self-Service)</p>
                <p className="text-xs text-muted-foreground">
                  Verknüpfte Mitarbeiter können ihre 4-stellige Display-PIN im
                  Profil neu setzen — nach Bestätigung mit dem Gwada-Passwort.
                  Die alte PIN wird aus Sicherheitsgründen nicht angezeigt.
                </p>
              </div>
              <Switch
                checked={profileAllowDisplayPinSelfService}
                onCheckedChange={setProfileAllowDisplayPinSelfService}
                disabled={loading}
                aria-label="Display-PIN Self-Service im Profil erlauben"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-card">
          <CardHeader className="gap-2">
            <CardTitle className="text-xl">Display-Zeiterfassung</CardTitle>
            <CardDescription>
              Automatische Abmeldung offener Stempel am Display — verhindert
              vergessene Schichten über Nacht und doppelte WhatsApp-Meldungen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between gap-4 rounded-xl border border-border/40 bg-muted/15 p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Automatisch abmelden</p>
                <p className="text-xs text-muted-foreground">
                  Offene Schicht oder Pause wird nach der eingestellten Dauer
                  still geschlossen (ohne WhatsApp „Schicht beendet“).
                </p>
              </div>
              <Switch
                checked={displayAutoClockOutEnabled}
                onCheckedChange={setDisplayAutoClockOutEnabled}
                disabled={loading}
                aria-label="Automatische Display-Abmeldung aktivieren"
              />
            </div>
            <div
              className={cn(
                "space-y-2",
                !displayAutoClockOutEnabled && "opacity-50",
              )}
            >
              <Label htmlFor="display-auto-clock-out-hours">
                Nach Stunden
              </Label>
              <Input
                id="display-auto-clock-out-hours"
                type="number"
                inputMode="numeric"
                min={DISPLAY_AUTO_CLOCK_OUT_HOURS_MIN}
                max={DISPLAY_AUTO_CLOCK_OUT_HOURS_MAX}
                step={1}
                value={displayAutoClockOutHours}
                disabled={loading || !displayAutoClockOutEnabled}
                onChange={(e) => setDisplayAutoClockOutHours(e.target.value)}
                className="h-11 max-w-[8rem] rounded-xl tabular-nums"
              />
              <p className="text-xs text-muted-foreground">
                {DISPLAY_AUTO_CLOCK_OUT_HOURS_MIN}–
                {DISPLAY_AUTO_CLOCK_OUT_HOURS_MAX} Stunden (Empfehlung:{" "}
                {DISPLAY_AUTO_CLOCK_OUT_HOURS_DEFAULT}).
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-card">
          <CardHeader className="gap-2">
            <CardTitle className="text-xl">Vertrags-Dokumente</CardTitle>
            <CardDescription>
              Tag für PDF-Arbeitsverträge im Modul Dokumente. Ohne Auswahl wird
              beim ersten Vertrag automatisch „
              {STAFF_CONTRACT_DEFAULT_DOCUMENT_TAG_NAME}“ angelegt.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Dokument-Tag</Label>
              <Select
                value={contractDocumentTagId ?? NONE_TAG_VALUE}
                onValueChange={(v) => {
                  if (typeof v !== "string") return;
                  setContractDocumentTagId(
                    v === NONE_TAG_VALUE ? null : v,
                  );
                }}
              >
                <SelectTrigger
                  className={appSelectTriggerAccentCn("h-11 w-full rounded-xl")}
                  disabled={loading}
                >
                  <SelectValue placeholder="Tag wählen">
                    {contractDocumentTagId
                      ? activeTags.find((t) => t.id === contractDocumentTagId)
                          ?.name ??
                        documentTags.find((t) => t.id === contractDocumentTagId)
                          ?.name
                      : "Automatisch (Mitarbeiter)"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_TAG_VALUE}>
                    Automatisch („{STAFF_CONTRACT_DEFAULT_DOCUMENT_TAG_NAME}“)
                  </SelectItem>
                  {documentTags.map((tag) => (
                    <SelectItem key={tag.id} value={tag.id}>
                      {tag.name}
                      {!tag.active ? " (inaktiv)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Tags verwalten im Modul{" "}
                <Link
                  href="/dashboard/dokumente"
                  className="text-accent underline-offset-4 hover:underline"
                >
                  Dokumente
                </Link>
                .
              </p>
            </div>
            <div className="flex items-start justify-between gap-4 rounded-xl border border-border/40 bg-muted/15 p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Zweistufige Unterzeichnung</p>
                <p className="text-xs text-muted-foreground">
                  Optional: HR unterschreibt zuerst, der Mitarbeiter erhält eine
                  Benachrichtigung und unterschreibt im Profil. Ohne Aktivierung
                  bleiben beide Unterschriften im gleichen Dialog wie bisher.
                </p>
              </div>
              <Switch
                checked={contractTwoStepSigning}
                onCheckedChange={setContractTwoStepSigning}
                disabled={loading}
                aria-label="Zweistufige Vertragsunterzeichnung aktivieren"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-card">
          <CardHeader>
            <CardTitle className="text-xl">Plattform-Vorlagen</CardTitle>
            <CardDescription>
              Standard-Mustertexte für Arbeitsverträge aus der Gwada-Bibliothek —
              abhängig vom Land des Restaurants. Importiert Vorlagen für alle
              passenden Beschäftigungsarten.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              size="lg"
              className={modulePrimaryAddButtonFullWidthClassName}
              disabled={!restaurantId || loading}
              onClick={() => setPlatformImportOpen(true)}
            >
              <Download className="size-4" />
              Standardvorlagen importieren
            </Button>
          </CardContent>
        </Card>
        </div>

        <SettingsStickySaveBar show={dirty}>
          <Button
            type="submit"
            disabled={saving || loading}
            className={cn(
              "h-11 w-full min-w-[12rem] sm:w-auto",
              settingsAccentSaveButtonClassName,
            )}
          >
            {saving ? "Speichern …" : "Einstellungen speichern"}
          </Button>
        </SettingsStickySaveBar>
      </form>

      {restaurantId ? (
        <StaffContractPlatformImportDrawer
          open={platformImportOpen}
          onOpenChange={setPlatformImportOpen}
          restaurantId={restaurantId}
        />
      ) : null}
    </div>
  );
}
