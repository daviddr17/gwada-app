"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { DrawerFormFooter } from "@/components/ui/drawer-form-footer";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DOCUMENT_TAG_NONE,
  DocumentTagSelect,
} from "@/components/documents/document-tag-select";
import { DocumentNotesSection } from "@/components/documents/document-notes-section";
import { RESTAURANT_DOCUMENT_ALLOWED_EXTENSIONS_LABEL } from "@/lib/constants/restaurant-documents";
import {
  RESTAURANT_DOCUMENT_FILE_ACCEPT,
  validateRestaurantDocumentFile,
} from "@/lib/documents/validate-restaurant-document-file";
import type {
  DocumentTagDefinition,
  RestaurantDocumentRow,
} from "@/lib/types/documents";
import { cn } from "@/lib/utils";

type DocumentFormDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "upload" | "edit";
  document: RestaurantDocumentRow | null;
  activeTags: DocumentTagDefinition[];
  onUpload: (params: {
    file: File;
    title: string;
    tagId: string | null;
  }) => Promise<boolean>;
  onSaveEdit: (params: {
    documentId: string;
    title: string;
    tagId: string | null;
  }) => Promise<boolean>;
  canEditNotes?: boolean;
  onNotesChanged?: () => void;
};

export function DocumentFormDrawer({
  open,
  onOpenChange,
  mode,
  document,
  activeTags,
  onUpload,
  onSaveEdit,
  canEditNotes = false,
  onNotesChanged,
}: DocumentFormDrawerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const [title, setTitle] = useState("");
  const [tagId, setTagId] = useState<string>(DOCUMENT_TAG_NONE);
  const [file, setFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [pending, setPending] = useState(false);

  const applySelectedFile = useCallback((next: File | null) => {
    if (!next) {
      setFile(null);
      return;
    }
    const err = validateRestaurantDocumentFile(next);
    if (err) {
      toast.error(err);
      return;
    }
    setFile(next);
    setTitle((prev) => {
      if (prev.trim()) return prev;
      const base = next.name.replace(/\.[^.]+$/, "").trim();
      return base || prev;
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && document) {
      setTitle(document.title);
      setTagId(document.tag_id ?? DOCUMENT_TAG_NONE);
      setFile(null);
    } else {
      setTitle("");
      setTagId(DOCUMENT_TAG_NONE);
      setFile(null);
    }
    dragDepthRef.current = 0;
    setIsDragOver(false);
  }, [open, mode, document]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current += 1;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragDepthRef.current = 0;
      setIsDragOver(false);
      const dropped = e.dataTransfer.files?.[0];
      if (dropped) applySelectedFile(dropped);
    },
    [applySelectedFile],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    setPending(true);
    try {
      if (mode === "upload") {
        if (!file) return;
        const ok = await onUpload({
          file,
          title: trimmed,
          tagId: tagId === DOCUMENT_TAG_NONE ? null : tagId,
        });
        if (ok) onOpenChange(false);
      } else if (document) {
        const ok = await onSaveEdit({
          documentId: document.id,
          title: trimmed,
          tagId: tagId === DOCUMENT_TAG_NONE ? null : tagId,
        });
        if (ok) onOpenChange(false);
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent
        className={cn(
          "mx-auto flex max-w-lg flex-col overflow-hidden rounded-t-[1.75rem] border-0 bg-card shadow-elevated",
          mode === "edit"
            ? "max-h-[min(92dvh,720px)]"
            : "max-h-[min(92dvh,560px)]",
        )}
      >
        <DrawerHeader className="shrink-0 px-5 pt-2 pb-2 text-left">
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            {mode === "upload" ? "Dokument hochladen" : "Dokument bearbeiten"}
          </DrawerTitle>
          <DrawerDescription className="text-base">
            {mode === "upload"
              ? "Datei auswählen oder vom Desktop hierher ziehen, Titel und optional ein Tag."
              : "Titel, Tag und Notizen."}
          </DrawerDescription>
        </DrawerHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden overscroll-contain px-5 pb-4">
            {mode === "upload" ? (
              <div className="space-y-2">
                <Label id="doc-file-label">Datei</Label>
                <input
                  ref={fileRef}
                  type="file"
                  className="sr-only"
                  accept={RESTAURANT_DOCUMENT_FILE_ACCEPT}
                  aria-labelledby="doc-file-label"
                  onChange={(ev) => {
                    applySelectedFile(ev.target.files?.[0] ?? null);
                    ev.target.value = "";
                  }}
                />
                <div
                  role="button"
                  tabIndex={0}
                  data-vaul-no-drag
                  aria-labelledby="doc-file-label"
                  className={cn(
                    "flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45",
                    isDragOver
                      ? "border-accent bg-accent/10"
                      : "border-border/60 bg-muted/25 hover:border-border hover:bg-muted/40",
                    file && "py-6",
                  )}
                  onClick={() => fileRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      fileRef.current?.click();
                    }
                  }}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  <Upload
                    className={cn(
                      "size-8 shrink-0",
                      isDragOver ? "text-accent" : "text-muted-foreground",
                    )}
                    aria-hidden
                  />
                  {file ? (
                    <>
                      <span className="max-w-full truncate text-sm font-medium">
                        {file.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Klicken oder andere Datei hierher ziehen
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-sm font-medium">
                        {isDragOver
                          ? "Datei loslassen …"
                          : "Datei auswählen oder hierher ziehen"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {RESTAURANT_DOCUMENT_ALLOWED_EXTENSIONS_LABEL} (max.
                        100 MB)
                      </span>
                    </>
                  )}
                </div>
              </div>
            ) : document ? (
              <p className="text-sm text-muted-foreground">
                Datei:{" "}
                <span className="font-medium text-foreground">
                  {document.file_name}
                </span>
              </p>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="doc-title">Titel</Label>
              <Input
                id="doc-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="z. B. Hygieneunterweisung 2026"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Tag</Label>
              <DocumentTagSelect
                activeTags={activeTags}
                value={tagId}
                onValueChange={setTagId}
                aria-label="Dokument-Tag"
              />
            </div>

            {mode === "edit" && document ? (
              <DocumentNotesSection
                open={open}
                restaurantId={document.restaurant_id}
                documentId={document.id}
                canEditNotes={canEditNotes}
                onNotesChanged={onNotesChanged}
              />
            ) : null}
          </div>

          <DrawerFormFooter
            onCancel={() => onOpenChange(false)}
            submitType="submit"
            submitPending={pending}
            submitDisabled={!title.trim() || (mode === "upload" && !file)}
            submitLabel={
              mode === "upload" ? "Hochladen" : "Speichern"
            }
          />
        </form>
      </DrawerContent>
    </Drawer>
  );
}
