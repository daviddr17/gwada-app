"use client";

import { useEffect, useState } from "react";
import { GripVertical, ImagePlus, Plus, Trash2, Video } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DrawerFormBody, DrawerFormSection } from "@/components/ui/drawer-form-section";
import { DrawerFormFooter } from "@/components/ui/drawer-form-footer";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  staffDrawerFieldClassName,
  staffDrawerScrollClassName,
} from "@/components/staff/staff-form-field-styles";
import { useDrawerFormSeed } from "@/lib/hooks/use-drawer-form-seed";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { hasModuleDelete } from "@/lib/permissions/module-crud-permissions";
import { archiveGuide, upsertGuide } from "@/lib/supabase/guides-db";
import { uploadGuideMediaClient } from "@/lib/guides/upload-guide-media-client";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import type {
  GuideStepUpsertInput,
  RestaurantGuideCategoryRow,
  RestaurantGuideRow,
} from "@/lib/types/guides";
import { cn } from "@/lib/utils";

const categorySelectClass = appSelectTriggerAccentCn(staffDrawerFieldClassName);

type StepDraft = {
  clientKey: string;
  id: string | null;
  body: string;
  image_storage_path: string | null;
  image_mime: string | null;
  image_size_bytes: number | null;
  image_url: string | null;
  video_storage_path: string | null;
  video_mime: string | null;
  video_size_bytes: number | null;
  video_url: string | null;
  clear_image: boolean;
  clear_video: boolean;
  uploading: boolean;
};

type GuideFormDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  guide: RestaurantGuideRow | null;
  categories: RestaurantGuideCategoryRow[];
  onSaved: () => void;
};

function newStepDraft(): StepDraft {
  return {
    clientKey: crypto.randomUUID(),
    id: null,
    body: "",
    image_storage_path: null,
    image_mime: null,
    image_size_bytes: null,
    image_url: null,
    video_storage_path: null,
    video_mime: null,
    video_size_bytes: null,
    video_url: null,
    clear_image: false,
    clear_video: false,
    uploading: false,
  };
}

function stepsFromGuide(guide: RestaurantGuideRow | null): StepDraft[] {
  const steps = guide?.steps ?? [];
  if (steps.length === 0) return [newStepDraft()];
  return [...steps]
    .sort((a, b) => a.position - b.position)
    .map((s) => ({
      clientKey: s.id,
      id: s.id,
      body: s.body ?? "",
      image_storage_path: s.image_storage_path,
      image_mime: s.image_mime,
      image_size_bytes: s.image_size_bytes,
      image_url: s.image_url ?? null,
      video_storage_path: s.video_storage_path,
      video_mime: s.video_mime,
      video_size_bytes: s.video_size_bytes,
      video_url: s.video_url ?? null,
      clear_image: false,
      clear_video: false,
      uploading: false,
    }));
}

export function GuideFormDrawer({
  open,
  onOpenChange,
  restaurantId,
  guide,
  categories,
  onSaved,
}: GuideFormDrawerProps) {
  const { has } = useRestaurantPermissions();
  const canDelete = hasModuleDelete(has, "guides");
  const isEdit = Boolean(guide?.id);

  const [title, setTitle] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [steps, setSteps] = useState<StepDraft[]>([newStepDraft()]);
  const [saving, setSaving] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [pendingGuideId, setPendingGuideId] = useState<string | null>(null);

  const categoryOptions = [
    { value: "", label: "Keine Kategorie" },
    ...categories
      .filter((c) => c.is_active || c.id === guide?.category_id)
      .map((c) => ({ value: c.id, label: c.name })),
  ];

  useDrawerFormSeed(open, guide?.id ?? "new", () => {
    setTitle(guide?.title ?? "");
    setShortDescription(guide?.short_description ?? "");
    setIsActive(guide?.is_active ?? true);
    setCategoryId(guide?.category_id ?? null);
    setSteps(stepsFromGuide(guide));
    setPendingGuideId(guide?.id ?? null);
    setSaving(false);
    setConfirmArchive(false);
  });

  useEffect(() => {
    if (!open) setConfirmArchive(false);
  }, [open]);

  async function ensureGuideIdForUpload(): Promise<string | null> {
    if (pendingGuideId) return pendingGuideId;
    if (guide?.id) return guide.id;

    const created = await upsertGuide(
      restaurantId,
      {
        title: title.trim() || "Neue Anleitung",
        short_description: shortDescription.trim() || null,
        is_active: isActive,
        category_id: categoryId,
        steps: [{ body: "", position: 0 }],
      },
      null,
    );
    if (created.error || !created.data) {
      toast.error(created.error ?? "Anleitung konnte nicht angelegt werden.");
      return null;
    }
    setPendingGuideId(created.data.id);
    return created.data.id;
  }

  async function handleMediaUpload(
    clientKey: string,
    file: File,
  ): Promise<void> {
    const guideId = await ensureGuideIdForUpload();
    if (!guideId) return;

    setSteps((prev) =>
      prev.map((s) =>
        s.clientKey === clientKey ? { ...s, uploading: true } : s,
      ),
    );

    const step = steps.find((s) => s.clientKey === clientKey);
    const result = await uploadGuideMediaClient({
      restaurantId,
      guideId,
      stepId: step?.id,
      file,
    });

    setSteps((prev) =>
      prev.map((s) => {
        if (s.clientKey !== clientKey) return s;
        if (result.error || !result.data) {
          return { ...s, uploading: false };
        }
        const d = result.data;
        if (d.kind === "image") {
          return {
            ...s,
            uploading: false,
            image_storage_path: d.storagePath,
            image_mime: d.mimeType,
            image_size_bytes: d.sizeBytes,
            image_url: d.url,
            clear_image: false,
            // one media kind per step for clarity
            video_storage_path: null,
            video_mime: null,
            video_size_bytes: null,
            video_url: null,
            clear_video: true,
          };
        }
        return {
          ...s,
          uploading: false,
          video_storage_path: d.storagePath,
          video_mime: d.mimeType,
          video_size_bytes: d.sizeBytes,
          video_url: d.url,
          clear_video: false,
          image_storage_path: null,
          image_mime: null,
          image_size_bytes: null,
          image_url: null,
          clear_image: true,
        };
      }),
    );

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Medien hochgeladen");
    }
  }

  async function handleSave() {
    if (!title.trim()) {
      toast.error("Bitte einen Titel eingeben.");
      return;
    }
    if (steps.some((s) => s.uploading)) {
      toast.error("Bitte warten, bis Uploads fertig sind.");
      return;
    }

    setSaving(true);
    const stepInputs: GuideStepUpsertInput[] = steps.map((s, i) => ({
      id: s.id,
      body: s.body,
      position: i,
      image_storage_path: s.image_storage_path,
      image_mime: s.image_mime,
      image_size_bytes: s.image_size_bytes,
      video_storage_path: s.video_storage_path,
      video_mime: s.video_mime,
      video_size_bytes: s.video_size_bytes,
      clear_image: s.clear_image,
      clear_video: s.clear_video,
    }));

    const result = await upsertGuide(
      restaurantId,
      {
        title,
        short_description: shortDescription,
        is_active: isActive,
        category_id: categoryId,
        steps: stepInputs,
      },
      pendingGuideId ?? guide?.id ?? null,
    );
    setSaving(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(isEdit || pendingGuideId ? "Anleitung gespeichert" : "Anleitung angelegt");
    onSaved();
    onOpenChange(false);
  }

  async function handleArchive() {
    const id = pendingGuideId ?? guide?.id;
    if (!id) return;
    setSaving(true);
    const { error } = await archiveGuide(restaurantId, id);
    setSaving(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Anleitung archiviert");
    setConfirmArchive(false);
    onSaved();
    onOpenChange(false);
  }

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
        <DrawerContent className={drawerContentClassName("formStaff")}>
          <DrawerHeader>
            <DrawerTitle>
              {isEdit || pendingGuideId ? "Anleitung bearbeiten" : "Anleitung anlegen"}
            </DrawerTitle>
            <DrawerDescription>
              Schritte mit Text und optional Bild oder Video.
            </DrawerDescription>
          </DrawerHeader>
          <DrawerFormBody className={staffDrawerScrollClassName}>
            <DrawerFormSection title="Allgemein">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="guide-title">Titel</Label>
                  <Input
                    id="guide-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className={staffDrawerFieldClassName}
                    placeholder="z. B. Kaffeemaschine reinigen"
                    maxLength={200}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="guide-desc">Kurzbeschreibung</Label>
                  <Textarea
                    id="guide-desc"
                    value={shortDescription}
                    onChange={(e) => setShortDescription(e.target.value)}
                    className={cn(staffDrawerFieldClassName, "min-h-20")}
                    placeholder="Optional, erscheint in der Liste"
                    maxLength={500}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Kategorie</Label>
                  <SearchableSelect
                    value={categoryId ?? ""}
                    onValueChange={(v) => setCategoryId(v || null)}
                    options={categoryOptions}
                    placeholder="Kategorie wählen"
                    searchPlaceholder="Kategorie suchen…"
                    className={categorySelectClass}
                  />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium">Aktiv</p>
                    <p className="text-xs text-muted-foreground">
                      Nur aktive Anleitungen erscheinen am Display.
                    </p>
                  </div>
                  <Switch
                    checked={isActive}
                    onCheckedChange={setIsActive}
                    aria-label="Anleitung aktiv"
                  />
                </div>
              </div>
            </DrawerFormSection>

            <DrawerFormSection title="Schritte">
              <div className="space-y-4">
                {steps.map((step, index) => (
                  <div
                    key={step.clientKey}
                    className="rounded-xl border border-border/50 p-3 space-y-3"
                  >
                    <div className="flex items-center gap-2">
                      <GripVertical className="size-4 text-muted-foreground" aria-hidden />
                      <p className="text-sm font-medium">Schritt {index + 1}</p>
                      {steps.length > 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="ml-auto"
                          onClick={() =>
                            setSteps((prev) =>
                              prev.filter((s) => s.clientKey !== step.clientKey),
                            )
                          }
                          aria-label={`Schritt ${index + 1} entfernen`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      ) : null}
                    </div>
                    <Textarea
                      value={step.body}
                      onChange={(e) =>
                        setSteps((prev) =>
                          prev.map((s) =>
                            s.clientKey === step.clientKey
                              ? { ...s, body: e.target.value }
                              : s,
                          ),
                        )
                      }
                      className={cn(staffDrawerFieldClassName, "min-h-24")}
                      placeholder="Beschreibung des Schritts…"
                      maxLength={8000}
                    />
                    {(step.image_url || step.image_storage_path) && !step.clear_image ? (
                      <div className="space-y-2">
                        {step.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={step.image_url}
                            alt=""
                            className="max-h-40 rounded-lg border border-border/40 object-cover"
                          />
                        ) : (
                          <p className="text-xs text-muted-foreground">Bild hinterlegt</p>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setSteps((prev) =>
                              prev.map((s) =>
                                s.clientKey === step.clientKey
                                  ? {
                                      ...s,
                                      image_storage_path: null,
                                      image_mime: null,
                                      image_size_bytes: null,
                                      image_url: null,
                                      clear_image: true,
                                    }
                                  : s,
                              ),
                            )
                          }
                        >
                          Bild entfernen
                        </Button>
                      </div>
                    ) : null}
                    {(step.video_url || step.video_storage_path) && !step.clear_video ? (
                      <div className="space-y-2">
                        {step.video_url ? (
                          <video
                            src={step.video_url}
                            controls
                            className="max-h-40 w-full rounded-lg border border-border/40"
                          />
                        ) : (
                          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Video className="size-3.5" />
                            Video hinterlegt
                          </p>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setSteps((prev) =>
                              prev.map((s) =>
                                s.clientKey === step.clientKey
                                  ? {
                                      ...s,
                                      video_storage_path: null,
                                      video_mime: null,
                                      video_size_bytes: null,
                                      video_url: null,
                                      clear_video: true,
                                    }
                                  : s,
                              ),
                            )
                          }
                        >
                          Video entfernen
                        </Button>
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <label
                        className={cn(
                          "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border/60 px-3 text-sm",
                          (step.uploading || saving) &&
                            "pointer-events-none opacity-50",
                        )}
                      >
                        <ImagePlus className="size-4" />
                        {step.uploading ? "Upload…" : "Bild / Video"}
                        <input
                          type="file"
                          accept="image/*,video/mp4,video/webm,video/quicktime"
                          className="sr-only"
                          disabled={step.uploading || saving}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            if (file) void handleMediaUpload(step.clientKey, file);
                          }}
                        />
                      </label>
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full rounded-xl"
                  onClick={() => setSteps((prev) => [...prev, newStepDraft()])}
                >
                  <Plus className="size-4" />
                  Schritt hinzufügen
                </Button>
              </div>
            </DrawerFormSection>

            <DrawerFormFooter
              submitPending={saving}
              submitType="button"
              onSubmit={() => void handleSave()}
              onCancel={() => onOpenChange(false)}
              showDelete={Boolean(isEdit || pendingGuideId) && canDelete}
              deleteLabel="Archivieren"
              onDelete={() => setConfirmArchive(true)}
              deleteDisabled={saving}
            />
          </DrawerFormBody>
        </DrawerContent>
      </Drawer>
      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title="Anleitung archivieren?"
        description="Die Anleitung verschwindet aus der Liste und vom Display."
        confirmLabel="Archivieren"
        onConfirm={() => void handleArchive()}
      />
    </>
  );
}
