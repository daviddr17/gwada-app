"use client";

import { useCallback, useEffect, useState } from "react";
import { drawerFormHeaderClassName, drawerScrollAreaClassName } from "@/lib/ui/drawer-form-section";
import { Check, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { dispatchSuperadminChangelogRefresh } from "@/lib/changelog/changelog-events";
import { ChangelogEntryCard } from "@/components/changelog/changelog-entry-card";
import { ChangelogOverviewSkeleton } from "@/components/changelog/changelog-overview-skeleton";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { DrawerFormBody } from "@/components/ui/drawer-form-section";
import { DrawerFormFooter } from "@/components/ui/drawer-form-footer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  datetimeLocalToIso,
  isoToDatetimeLocal,
} from "@/lib/changelog/changelog-format";
import { joinChangelogBody, parseChangelogBody } from "@/lib/changelog/changelog-body-sections";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import {
  approveSuperadminChangelogEntry,
  createSuperadminChangelogEntry,
  deleteSuperadminChangelogEntry,
  fetchSuperadminChangelogEntries,
  syncSuperadminChangelogFromGit,
  updateSuperadminChangelogEntry,
} from "@/lib/superadmin/platform-changelog-api";
import type {
  PlatformChangelogAudience,
  PlatformChangelogEntry,
} from "@/lib/types/platform-changelog";
import { CHANGELOG_AUDIENCE_LABELS } from "@/lib/types/platform-changelog";
import { modulePrimaryAddButtonClassName } from "@/lib/ui/module-primary-add-button";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { cn } from "@/lib/utils";

type FormState = {
  title: string;
  customerBody: string;
  superadminBody: string;
  publishedAtLocal: string;
  version: string;
  audience: PlatformChangelogAudience;
};

function emptyForm(): FormState {
  return {
    title: "",
    customerBody: "",
    superadminBody: "",
    publishedAtLocal: isoToDatetimeLocal(new Date().toISOString()),
    version: "",
    audience: "customers",
  };
}

function entryToForm(entry: PlatformChangelogEntry): FormState {
  const { customerBody, superadminBody } = parseChangelogBody(entry.body);
  return {
    title: entry.title,
    customerBody:
      entry.audience === "superadmin" ? "" : customerBody,
    superadminBody:
      entry.audience === "superadmin" ? entry.body : superadminBody,
    publishedAtLocal: isoToDatetimeLocal(entry.publishedAt),
    version: entry.version ?? "",
    audience: entry.audience,
  };
}

export function SuperadminChangelogPanel() {
  const [entries, setEntries] = useState<PlatformChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const showSkeleton = useDeferredSkeleton(loading && entries.length === 0);
  const pendingCount = entries.filter((entry) => !entry.approvedAt).length;

  const load = useCallback(async () => {
    setLoading(true);
    const { entries: data, error } = await fetchSuperadminChangelogEntries();
    if (error) toast.error(error);
    setEntries(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (entry: PlatformChangelogEntry) => {
    setEditingId(entry.id);
    setForm(entryToForm(entry));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const publishedAt = datetimeLocalToIso(form.publishedAtLocal);
    if (!form.title.trim()) {
      toast.error("Bitte einen Titel eingeben.");
      return;
    }
    if (!publishedAt) {
      toast.error("Bitte Datum und Uhrzeit setzen.");
      return;
    }
    if (form.audience === "customers" && !form.customerBody.trim()) {
      toast.error("Bitte mindestens einen Kunden-Punkt eintragen.");
      return;
    }
    if (form.audience === "superadmin" && !form.superadminBody.trim()) {
      toast.error("Bitte internen Text eintragen.");
      return;
    }

    setSaving(true);
    const body =
      form.audience === "superadmin"
        ? form.superadminBody
        : joinChangelogBody(form.customerBody, form.superadminBody);
    const payload = {
      title: form.title,
      body,
      publishedAt,
      version: form.version.trim() || null,
      audience: form.audience,
    };

    const result = editingId
      ? await updateSuperadminChangelogEntry(editingId, payload)
      : await createSuperadminChangelogEntry(payload);

    setSaving(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(
      editingId
        ? "Eintrag aktualisiert."
        : "Eintrag gespeichert — Freigabe ausstehend.",
    );
    setDialogOpen(false);
    void load();
    dispatchSuperadminChangelogRefresh();
  };

  const handleApprove = async (id: string) => {
    setApprovingId(id);
    const { entry, error } = await approveSuperadminChangelogEntry(id);
    setApprovingId(null);
    if (error || !entry) {
      toast.error(error ?? "Freigabe fehlgeschlagen.");
      return;
    }
    toast.success("Changelog für Kunden freigegeben.");
    void load();
    dispatchSuperadminChangelogRefresh();
  };

  const handleDelete = async (id: string) => {
    const { error } = await deleteSuperadminChangelogEntry(id);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Eintrag gelöscht.");
    void load();
    dispatchSuperadminChangelogRefresh();
  };

  const handleGitSync = async () => {
    setSyncing(true);
    const { result, error } = await syncSuperadminChangelogFromGit();
    setSyncing(false);
    if (error) {
      toast.error(error);
      return;
    }
    const created = result?.created.length ?? 0;
    const skipped = result?.skipped.length ?? 0;
    if (result?.errors.length) {
      toast.error(result.errors.join(" · "));
    }
    if (created > 0) {
      toast.success(
        `${created} Eintrag${created === 1 ? "" : "e"} aus Git übernommen — Freigabe ausstehend.`,
      );
      void load();
      dispatchSuperadminChangelogRefresh();
    } else if (skipped > 0) {
      toast.message("Keine neuen Commits — bereits synchronisiert.");
    } else {
      toast.message(
        "Keine Commits mit Changelog:-Block gefunden (siehe Hinweis unten).",
      );
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-12 rounded-full px-6"
          disabled={syncing}
          onClick={() => void handleGitSync()}
        >
          <RefreshCw
            className={cn("mr-1.5 size-4", syncing && "animate-spin")}
          />
          Aus Git synchronisieren
        </Button>
        <Button
          type="button"
          size="lg"
          className={cn(modulePrimaryAddButtonClassName)}
          onClick={openCreate}
        >
          <Plus className="mr-1.5 size-4" />
          Eintrag hinzufügen
        </Button>
      </div>

      {showSkeleton ? (
        <ChangelogOverviewSkeleton />
      ) : entries.length === 0 ? (
        <Card className="border-border/50 shadow-card">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Noch keine Changelog-Einträge. Lege den ersten an, bevor du live
            gehst.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {pendingCount > 0 ? (
            <p className="text-sm text-muted-foreground">
              {pendingCount} Eintrag{pendingCount === 1 ? "" : "e"} warten auf
              Freigabe für Endkunden.
            </p>
          ) : null}
          {entries.map((entry) => (
            <ChangelogEntryCard
              key={entry.id}
              entry={entry}
              showAudienceBadge
              showApprovalBadge
              showSuperadminSections
              actions={
                <>
                  {!entry.approvedAt ? (
                    <Button
                      type="button"
                      size="icon-sm"
                      className="rounded-xl"
                      aria-label="Für Kunden freigeben"
                      disabled={approvingId === entry.id}
                      onClick={() => void handleApprove(entry.id)}
                    >
                      <Check className="size-3.5" />
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className="rounded-xl"
                    aria-label="Eintrag bearbeiten"
                    onClick={() => openEdit(entry)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className="rounded-xl text-destructive hover:text-destructive"
                    aria-label="Eintrag löschen"
                    onClick={() => void handleDelete(entry.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </>
              }
            />
          ))}
        </div>
      )}

      <Card className="border-border/50 shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Hinweis</CardTitle>
          <CardDescription className="space-y-2">
            <p>
              <strong>Kunden-Teil:</strong> Was sich für Restaurant-Teams merkbar
              ändert — in Alltagssprache, mit Nutzen („Du kannst jetzt …“). Keine
              Commits, APIs, Migrationen oder interne Begriffe.
            </p>
            <p>
              <strong>Superadmin-Teil (optional):</strong> Deploy, Schema, Sync —
              wird violett hervorgehoben und ist für Endkunden unsichtbar.
            </p>
            <p>
              Automatisch bei Push auf <code className="text-xs">main</code>, wenn{" "}
              <code className="text-xs">CHANGELOG_SYNC_URL</code> gesetzt ist. Quelle:{" "}
              <code className="text-xs">content/changelog.draft.json</code> mit{" "}
              <code className="text-xs">title</code>,{" "}
              <code className="text-xs">body</code>, optional{" "}
              <code className="text-xs">superadminBody</code>,{" "}
              <code className="text-xs">version</code>. Kein{" "}
              <code className="text-xs">Changelog:</code>-Block im Commit.
            </p>
          </CardDescription>
        </CardHeader>
      </Card>

      <Drawer
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        direction="bottom"
        repositionInputs={false}
      >
        <DrawerContent className="mx-auto flex max-h-[min(92dvh,720px)] max-w-lg flex-col rounded-t-[1.75rem] border-0 bg-card shadow-elevated">
          <DrawerHeader className={drawerFormHeaderClassName(6)}>
            <DrawerTitle className="text-xl font-semibold tracking-tight">
              {editingId ? "Eintrag bearbeiten" : "Neuer Changelog-Eintrag"}
            </DrawerTitle>
          </DrawerHeader>
          <DrawerFormBody>
          <div className={drawerScrollAreaClassName(6)}>
            <div className="space-y-2">
              <Label htmlFor="changelog-title">Titel</Label>
              <Input
                id="changelog-title"
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="z. B. Reservierungen: Erinnerungen per WhatsApp"
                className="rounded-xl"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="changelog-published">Veröffentlicht am</Label>
                <Input
                  id="changelog-published"
                  type="datetime-local"
                  value={form.publishedAtLocal}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      publishedAtLocal: e.target.value,
                    }))
                  }
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="changelog-version">Version (optional)</Label>
                <Input
                  id="changelog-version"
                  value={form.version}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, version: e.target.value }))
                  }
                  placeholder="z. B. 2026.05.31"
                  className="rounded-xl"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="changelog-audience">Zielgruppe</Label>
              <Select
                value={form.audience}
                onValueChange={(value) =>
                  setForm((f) => ({
                    ...f,
                    audience: value as PlatformChangelogAudience,
                  }))
                }
              >
                <SelectTrigger
                  id="changelog-audience"
                  className={appSelectTriggerAccentCn("h-10 w-full rounded-xl")}
                >
                  <SelectValue>
                    {CHANGELOG_AUDIENCE_LABELS[form.audience]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customers">
                    {CHANGELOG_AUDIENCE_LABELS.customers}
                  </SelectItem>
                  <SelectItem value="superadmin">
                    {CHANGELOG_AUDIENCE_LABELS.superadmin}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="changelog-customer-body">Für alle Kunden</Label>
              <Textarea
                id="changelog-customer-body"
                value={form.customerBody}
                onChange={(e) =>
                  setForm((f) => ({ ...f, customerBody: e.target.value }))
                }
                rows={6}
                disabled={form.audience === "superadmin"}
                placeholder={
                  "- Gäste können Reservierungen per WhatsApp bestätigen lassen\n- In der Speisekarte findest du Gerichte schneller über die Suche"
                }
                className="rounded-xl text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Bullet-Zeilen mit „-“. Was ändert sich im Alltag — nicht wie es
                technisch umgesetzt ist.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="changelog-superadmin-body">
                Intern (optional)
              </Label>
              <Textarea
                id="changelog-superadmin-body"
                value={form.superadminBody}
                onChange={(e) =>
                  setForm((f) => ({ ...f, superadminBody: e.target.value }))
                }
                rows={4}
                placeholder={
                  "- Deploy-Workflow angepasst\n- Migration platform_changelog …"
                }
                className="rounded-xl border-violet-500/25 bg-violet-500/[0.04] font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Nur für Superadmins sichtbar — violett markiert im Changelog.
              </p>
            </div>
          </div>
          <DrawerFormFooter
            onCancel={() => setDialogOpen(false)}
            submitType="button"
            onSubmit={() => void handleSave()}
            submitPending={saving}
          />
          </DrawerFormBody>
        </DrawerContent>
      </Drawer>
    </>
  );
}
