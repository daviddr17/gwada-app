"use client";

import { useCallback, useRef, useState } from "react";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerScrollAreaClassName, drawerFormHeaderClassName } from "@/lib/ui/drawer-form-section";
import { ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { DrawerFormBody, DrawerFormSection } from "@/components/ui/drawer-form-section";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DrawerFormFooter } from "@/components/ui/drawer-form-footer";
import { validateGalleryMediaFile } from "@/lib/gallery/validate-gallery-media-file";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  onSaved: () => void;
};

export function GalleryComposeDrawer({
  open,
  onOpenChange,
  restaurantId,
  onSaved,
}: Props) {
  const itemIdRef = useRef(crypto.randomUUID());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [category, setCategory] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingUpload, setPendingUpload] = useState<{
    storagePath: string;
    mimeType: string;
    sizeBytes: number;
  } | null>(null);

  const reset = useCallback(() => {
    itemIdRef.current = crypto.randomUUID();
    setTitle("");
    setCaption("");
    setCategory("");
    setPreviewUrl(null);
    setPendingUpload(null);
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      const err = validateGalleryMediaFile(file);
      if (err) {
        toast.error("Datei ungültig");
        return;
      }
      setUploading(true);
      try {
        const form = new FormData();
        form.set("restaurantId", restaurantId);
        form.set("itemId", itemIdRef.current);
        form.set("file", file);
        const res = await fetch("/api/gallery/media/upload", { method: "POST", body: form });
        const data = (await res.json()) as {
          error?: string;
          storagePath?: string;
          mimeType?: string;
          sizeBytes?: number;
          previewUrl?: string;
        };
        if (!res.ok) {
          toast.error(data.error === "storage_quota_exceeded" ? "Speicher voll (3 GB)" : "Upload fehlgeschlagen");
          return;
        }
        setPendingUpload({
          storagePath: data.storagePath!,
          mimeType: data.mimeType!,
          sizeBytes: data.sizeBytes!,
        });
        setPreviewUrl(data.previewUrl ?? URL.createObjectURL(file));
      } finally {
        setUploading(false);
      }
    },
    [restaurantId],
  );

  const handleSave = useCallback(async () => {
    if (!pendingUpload) {
      toast.error("Bitte zuerst ein Bild wählen");
      return;
    }
    setUploading(true);
    try {
      const res = await fetch("/api/gallery/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          itemId: itemIdRef.current,
          title: title.trim() || null,
          caption: caption.trim() || null,
          category: category.trim() || null,
          ...pendingUpload,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error === "storage_quota_exceeded" ? "Speicher voll (3 GB)" : "Speichern fehlgeschlagen");
        return;
      }
      toast.success("Bild hinzugefügt");
      reset();
      onOpenChange(false);
      onSaved();
    } finally {
      setUploading(false);
    }
  }, [pendingUpload, restaurantId, title, caption, category, reset, onOpenChange, onSaved]);

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent className={drawerContentClassName("mediaTall")}>
        <DrawerHeader className="text-left">
          <DrawerTitle>Bild hinzufügen</DrawerTitle>
        </DrawerHeader>
        <DrawerFormBody>
        <div className={drawerScrollAreaClassName(4)}>
          <DrawerFormSection contentPadding={4} title="Medien">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <button
            type="button"
            data-vaul-no-drag
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "flex min-h-32 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground",
            )}
          >
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="" className="max-h-40 rounded-lg object-contain" />
            ) : (
              <>
                <ImagePlus className="size-8 opacity-60" />
                Bild oder Video wählen
              </>
            )}
          </button>
          </DrawerFormSection>

          <DrawerFormSection contentPadding={4} title="Metadaten">
          <div className="space-y-2">
            <Label htmlFor="gallery-title">Titel</Label>
            <Input id="gallery-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gallery-caption">Beschreibung</Label>
            <Input id="gallery-caption" value={caption} onChange={(e) => setCaption(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gallery-category">Kategorie</Label>
            <Input id="gallery-category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="z. B. Speisekarte" />
          </div>
          </DrawerFormSection>
        </div>
        <DrawerFormFooter
          onCancel={() => onOpenChange(false)}
          onSubmit={() => void handleSave()}
          submitLabel="Speichern"
          submitDisabled={uploading || !pendingUpload}
        />
        </DrawerFormBody>
      </DrawerContent>
    </Drawer>
  );
}
