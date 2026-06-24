"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DrawerFormFooter } from "@/components/ui/drawer-form-footer";
import { DrawerFormBody, DrawerFormSection } from "@/components/ui/drawer-form-section";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SortableDragOverlay } from "@/components/ui/sortable-drag-overlay";
import { StaffContractPlaceholderReference } from "@/components/staff/staff-contract-placeholder-reference";
import {
  staffDrawerFieldClassName,
  staffDrawerScrollClassName,
} from "@/components/staff/staff-form-field-styles";
import { useSortableReorder } from "@/lib/hooks/use-sortable-reorder";
import {
  deleteStaffContractTemplate,
  loadStaffContractTemplateWithParagraphs,
  saveStaffContractTemplateFull,
  type StaffContractTemplateDraftParagraph,
} from "@/lib/supabase/staff-contract-templates-db";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import {
  drawerFormHeaderClassName,
  drawerScrollAreaClassName,
} from "@/lib/ui/drawer-form-section";
import { cn } from "@/lib/utils";

type ParagraphDraft = StaffContractTemplateDraftParagraph & {
  clientId: string;
};

function newParagraphDraft(): ParagraphDraft {
  return {
    clientId:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `p-${Date.now()}-${Math.random()}`,
    heading: "",
    body: "",
  };
}

export function StaffContractTemplateDrawer({
  open,
  onOpenChange,
  restaurantId,
  employmentTypeId,
  employmentTypeName,
  templateId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  employmentTypeId: string;
  employmentTypeName: string;
  templateId: string | null;
  onSaved: () => void;
}) {
  const isEdit = Boolean(templateId);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [paragraphs, setParagraphs] = useState<ParagraphDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const activeBodyRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!open) return;
    if (!templateId) {
      setName("");
      setTitle("Arbeitsvertrag");
      setIsActive(true);
      setParagraphs([newParagraphDraft()]);
      return;
    }

    let cancel = false;
    setLoading(true);
    void (async () => {
      const { data, error } =
        await loadStaffContractTemplateWithParagraphs(templateId);
      if (cancel) return;
      setLoading(false);
      if (error || !data) {
        toast.error("Mustervorlage konnte nicht geladen werden.");
        return;
      }
      setName(data.name);
      setTitle(data.title);
      setIsActive(data.is_active);
      setParagraphs(
        data.paragraphs.length > 0
          ? data.paragraphs.map((p) => ({
              clientId: p.id,
              id: p.id,
              heading: p.heading ?? "",
              body: p.body,
            }))
          : [newParagraphDraft()],
      );
    })();

    return () => {
      cancel = true;
    };
  }, [open, templateId]);

  const paragraphIds = useMemo(
    () => paragraphs.map((p) => p.clientId),
    [paragraphs],
  );

  const sort = useSortableReorder({
    itemIds: paragraphIds,
    onReorder: ({ fromIndex, toIndex }) => {
      setParagraphs((prev) => {
        const next = [...prev];
        const [removed] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, removed);
        return next;
      });
    },
  });

  const insertPlaceholder = useCallback((token: string) => {
    const el = activeBodyRef.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const nextValue =
      el.value.slice(0, start) + token + el.value.slice(end);
    const clientId = el.dataset.paragraphClientId;
    if (!clientId) return;
    setParagraphs((prev) =>
      prev.map((p) =>
        p.clientId === clientId ? { ...p, body: nextValue } : p,
      ),
    );
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }, []);

  const save = async () => {
    setPending(true);
    const result = await saveStaffContractTemplateFull({
      restaurantId,
      employmentTypeId,
      templateId,
      name,
      title,
      isActive,
      paragraphs: paragraphs.map(({ heading, body, id }) => ({
        id,
        heading,
        body,
      })),
    });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(isEdit ? "Mustervorlage gespeichert" : "Mustervorlage angelegt");
    onSaved();
    onOpenChange(false);
  };

  const remove = async () => {
    if (!templateId) return;
    setPending(true);
    const ok = await deleteStaffContractTemplate(templateId);
    setPending(false);
    if (!ok) {
      toast.error("Mustervorlage konnte nicht gelöscht werden.");
      return;
    }
    toast.success("Mustervorlage gelöscht");
    onSaved();
    onOpenChange(false);
  };

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={onOpenChange}
        direction="bottom"
        repositionInputs={false}
      >
        <DrawerContent className={drawerContentClassName("overview")}>
          <DrawerHeader className={drawerFormHeaderClassName(6)}>
            <DrawerTitle className="text-xl font-semibold tracking-tight">
              {isEdit ? "Mustervorlage bearbeiten" : "Neue Mustervorlage"}
            </DrawerTitle>
            <DrawerDescription className="text-base">
              {employmentTypeName} — Überschrift, Paragraphen und Platzhalter.
            </DrawerDescription>
          </DrawerHeader>

          <DrawerFormBody>
          <div className={cn(drawerScrollAreaClassName(6), staffDrawerScrollClassName)}>
            {loading ? (
              <p className="text-sm text-muted-foreground">Wird geladen …</p>
            ) : (
              <div className="space-y-6">
                <DrawerFormSection title="Allgemein" contentPadding={5}>
                  <div className="space-y-2">
                    <Label>Name der Vorlage</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="z. B. Vollzeit Standard"
                      className={staffDrawerFieldClassName}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Vertragsüberschrift</Label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="z. B. Arbeitsvertrag oder {{mitarbeiter.nachname}}"
                      className={staffDrawerFieldClassName}
                    />
                    <p className="text-xs text-muted-foreground">
                      Platzhalter wie in den Paragraphen (z. B.{" "}
                      <code className="rounded bg-muted px-1">{`{{mitarbeiter.vorname}}`}</code>
                      ) werden bei der Vertragserstellung ersetzt.
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-border/40 bg-muted/15 px-3 py-2.5">
                    <div>
                      <Label htmlFor="template-active" className="text-sm">
                        Aktiv
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Inaktive Vorlagen erscheinen nicht bei der Vertragserstellung.
                      </p>
                    </div>
                    <Switch
                      id="template-active"
                      checked={isActive}
                      onCheckedChange={(v) => setIsActive(v === true)}
                    />
                  </div>
                </DrawerFormSection>

                <DrawerFormSection title="Paragraphen" contentPadding={5}>
                  <div className="mb-3 flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-lg"
                      onClick={() =>
                        setParagraphs((prev) => [...prev, newParagraphDraft()])
                      }
                    >
                      <Plus className="size-3.5" />
                      Paragraph
                    </Button>
                  </div>
                  <ul className="space-y-4">
                    {paragraphs.map((paragraph, index) => {
                      const handle = sort.getHandleProps(paragraph.clientId);
                      return (
                        <li
                          key={paragraph.clientId}
                          ref={(el) =>
                            sort.registerItemRef(paragraph.clientId, el)
                          }
                          className={sort.getItemDropClassName(
                            paragraph.clientId,
                            "rounded-xl border border-border/40 bg-background/80 p-3",
                          )}
                        >
                          <div className="mb-3 flex items-center gap-2">
                            <div
                              {...handle}
                              className={cn(
                                "flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/40 text-muted-foreground",
                                handle.className,
                              )}
                            >
                              <GripVertical className="size-4" />
                            </div>
                            <span className="text-sm font-medium text-muted-foreground">
                              § {index + 1}
                            </span>
                            {paragraphs.length > 1 ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="ml-auto rounded-lg text-muted-foreground"
                                aria-label="Paragraph entfernen"
                                onClick={() =>
                                  setParagraphs((prev) =>
                                    prev.filter(
                                      (p) => p.clientId !== paragraph.clientId,
                                    ),
                                  )
                                }
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            ) : null}
                          </div>
                          <div className="space-y-2">
                            <Input
                              value={paragraph.heading}
                              onChange={(e) =>
                                setParagraphs((prev) =>
                                  prev.map((p) =>
                                    p.clientId === paragraph.clientId
                                      ? { ...p, heading: e.target.value }
                                      : p,
                                  ),
                                )
                              }
                              placeholder="Überschrift (optional)"
                              className={staffDrawerFieldClassName}
                            />
                            <Textarea
                              data-paragraph-client-id={paragraph.clientId}
                              ref={(el) => {
                                if (
                                  document.activeElement === el ||
                                  !activeBodyRef.current
                                ) {
                                  activeBodyRef.current = el;
                                }
                              }}
                              onFocus={(e) => {
                                activeBodyRef.current = e.currentTarget;
                              }}
                              value={paragraph.body}
                              onChange={(e) =>
                                setParagraphs((prev) =>
                                  prev.map((p) =>
                                    p.clientId === paragraph.clientId
                                      ? { ...p, body: e.target.value }
                                      : p,
                                  ),
                                )
                              }
                              placeholder="Vertragstext mit Platzhaltern …"
                              rows={4}
                              className={cn(
                                staffDrawerFieldClassName,
                                "min-h-[6rem] resize-y",
                              )}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </DrawerFormSection>

                <StaffContractPlaceholderReference onInsert={insertPlaceholder} />
              </div>
            )}
          </div>

          <DrawerFormFooter
            onCancel={() => onOpenChange(false)}
            cancelLabel="Abbrechen"
            submitLabel={isEdit ? "Speichern" : "Anlegen"}
            submitType="button"
            onSubmit={() => void save()}
            submitDisabled={pending || loading || !name.trim()}
            submitPending={pending}
            showDelete={isEdit}
            onDelete={() => setConfirmDelete(true)}
            deleteLabel="Mustervorlage löschen"
          />
          </DrawerFormBody>
        </DrawerContent>
      </Drawer>

      <SortableDragOverlay
        activeId={sort.activeId}
        dragLayout={sort.dragLayout}
        showGapLine={sort.wouldReorder}
        renderGhost={(activeId) => {
          const paragraph = paragraphs.find((p) => p.clientId === activeId);
          if (!paragraph) return null;
          return (
            <div className="p-3 text-sm text-muted-foreground">
              {paragraph.heading || "Paragraph"}
            </div>
          );
        }}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Mustervorlage löschen?"
        description="Die Vorlage und alle Paragraphen werden entfernt."
        confirmLabel="Löschen"
        onConfirm={() => void remove()}
      />
    </>
  );
}
