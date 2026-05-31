"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import {
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
  body: string;
  publishedAtLocal: string;
  version: string;
  audience: PlatformChangelogAudience;
};

function emptyForm(): FormState {
  return {
    title: "",
    body: "",
    publishedAtLocal: isoToDatetimeLocal(new Date().toISOString()),
    version: "",
    audience: "customers",
  };
}

function entryToForm(entry: PlatformChangelogEntry): FormState {
  return {
    title: entry.title,
    body: entry.body,
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
  const showSkeleton = useDeferredSkeleton(loading && entries.length === 0);

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

    setSaving(true);
    const payload = {
      title: form.title,
      body: form.body,
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

    toast.success(editingId ? "Eintrag aktualisiert." : "Eintrag veröffentlicht.");
    setDialogOpen(false);
    void load();
  };

  const handleDelete = async (id: string) => {
    const { error } = await deleteSuperadminChangelogEntry(id);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Eintrag gelöscht.");
    void load();
  };

  const handleGitSync = async () => {
    setSyncing(true);
    const { result, error } = await syncSuperadminChangelogFromGit({
      gitRange: "HEAD~30..HEAD",
    });
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
        `${created} Eintrag${created === 1 ? "" : "e"} aus Git übernommen.`,
      );
      void load();
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
          className="rounded-xl"
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
          {entries.map((entry) => (
            <div key={entry.id} className="relative">
              <ChangelogEntryCard entry={entry} showAudienceBadge />
              <div className="absolute right-3 top-3 flex gap-1 sm:right-4 sm:top-4">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8 rounded-xl bg-card/90 backdrop-blur-sm"
                  aria-label="Eintrag bearbeiten"
                  onClick={() => openEdit(entry)}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8 rounded-xl bg-card/90 text-destructive backdrop-blur-sm hover:text-destructive"
                  aria-label="Eintrag löschen"
                  onClick={() => void handleDelete(entry.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Card className="border-border/50 shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Hinweis</CardTitle>
          <CardDescription>
            Automatisch bei <strong>Push auf</strong>{" "}
            <code className="text-xs">main</code> (GitHub Action), wenn{" "}
            <code className="text-xs">CHANGELOG_SYNC_URL</code> und Secret
            gesetzt sind. Commits brauchen einen{" "}
            <code className="text-xs">Changelog:</code>-Block im Body — oder
            lege{" "}
            <code className="text-xs">content/changelog.draft.json</code> an.
            Zielgruppe optional:{" "}
            <code className="text-xs">Changelog-Audience: superadmin</code>.
            Duplikate werden anhand der Git-SHA übersprungen. Einträge kannst
            du danach hier noch bearbeiten.
          </CardDescription>
        </CardHeader>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Eintrag bearbeiten" : "Neuer Changelog-Eintrag"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="changelog-title">Titel</Label>
              <Input
                id="changelog-title"
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="z. B. Reservierungen: WhatsApp-Erinnerungen"
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
                  <SelectValue />
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
              <Label htmlFor="changelog-body">Neuigkeiten</Label>
              <Textarea
                id="changelog-body"
                value={form.body}
                onChange={(e) =>
                  setForm((f) => ({ ...f, body: e.target.value }))
                }
                rows={8}
                placeholder={"- Speisekarte lädt schneller\n- Changelog in der Sidebar\n- …"}
                className="rounded-xl font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setDialogOpen(false)}
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              className="rounded-xl"
              disabled={saving}
              onClick={() => void handleSave()}
            >
              {saving ? "Speichern…" : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
