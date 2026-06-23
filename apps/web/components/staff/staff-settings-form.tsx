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
  contractTwoStepSigning: boolean;
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
  const [contractTwoStepSigning, setContractTwoStepSigning] = useState(false);
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
      contractTwoStepSigning,
    }),
    [
      contractDocumentTagId,
      profileShowWorkHours,
      profileShowShiftPlan,
      profileShowDocuments,
      contractTwoStepSigning,
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
    setContractTwoStepSigning(next.contractTwoStepSigning);
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
        contractTwoStepSigning: data?.contract_two_step_signing ?? false,
      });
    })();
    return () => {
      cancel = true;
    };
  }, [restaurantId]);

  const save = () => {
    if (!restaurantId) return;
    setSaving(true);
    void (async () => {
      const { error } = await upsertStaffModuleSettings({
        restaurantId,
        contractDocumentTagId,
        profileShowWorkHours,
        profileShowShiftPlan,
        profileShowDocuments,
        contractTwoStepSigning,
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
    <div className="space-y-6 pb-4">
      <form
        className="contents"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
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
