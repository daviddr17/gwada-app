"use client";

import { useCallback, useEffect, useState } from "react";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerScrollAreaClassName, drawerFormHeaderClassName } from "@/lib/ui/drawer-form-section";
import { DrawerFormSection } from "@/components/ui/drawer-form-section";
import { Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { DrawerFormFooter } from "@/components/ui/drawer-form-footer";
import { FeedPinButton } from "@/components/feed-pin/feed-pin-button";
import {
  DatePickerField,
  formScheduleTimeInputClassName,
} from "@/components/ui/date-picker";
import {
  EventsDetailActions,
} from "@/components/events/events-feed-views";
import { EventsPlatformIcon } from "@/components/events/events-platform-icon";
import { EVENTS_PLATFORM_LABELS } from "@/lib/constants/events-platforms";
import {
  formatEventDateRange,
} from "@/lib/events/format-events-display-date";
import { uploadEventsMedia } from "@/lib/events/events-media-api";
import { validateEventsMediaFile } from "@/lib/events/validate-events-media-file";
import type { UnifiedEventItem } from "@/lib/events/unified-event-item";
import { Badge } from "@/components/ui/badge";

function combineDateTime(dateYmd: string, time: string): string | null {
  if (!dateYmd || !time) return null;
  const iso = new Date(`${dateYmd}T${time}:00`).toISOString();
  return Number.isNaN(new Date(iso).getTime()) ? null : iso;
}

function isoToDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isoToTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function EventsDetailDrawer({
  open,
  onOpenChange,
  item,
  restaurantId,
  canManage,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: UnifiedEventItem | null;
  restaurantId: string;
  canManage: boolean;
  onChanged: (nextPinned?: boolean) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [ticketUrl, setTicketUrl] = useState("");
  const [location, setLocation] = useState("");
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverStoragePath, setCoverStoragePath] = useState<string | null>(null);
  const [coverMimeType, setCoverMimeType] = useState<string | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isGwadaEditable =
    canManage &&
    item?.source === "gwada" &&
    Boolean(item.eventId) &&
    item.canEdit;

  useEffect(() => {
    if (!open || !item) return;
    setTitle(item.title ?? "");
    setDescription(item.description ?? "");
    setStartDate(isoToDate(item.startAt));
    setStartTime(isoToTime(item.startAt));
    setEndDate(item.endAt ? isoToDate(item.endAt) : "");
    setEndTime(item.endAt ? isoToTime(item.endAt) : "");
    setTicketUrl(item.ticketUrl ?? "");
    setLocation(item.location ?? "");
    setCoverPreview(item.coverUrl);
    setCoverStoragePath(item.coverStoragePath);
    setCoverMimeType(null);
    setRemoveCover(false);
  }, [open, item]);

  const uploadCover = useCallback(
    async (file: File) => {
      if (!item?.eventId) return;
      const err = validateEventsMediaFile(file);
      if (err) {
        toast.error(err);
        return;
      }
      setUploading(true);
      try {
        const result = await uploadEventsMedia({
          restaurantId,
          eventId: item.eventId,
          file,
        });
        if ("error" in result) throw new Error(result.error);
        if (coverPreview?.startsWith("blob:")) URL.revokeObjectURL(coverPreview);
        setCoverPreview(URL.createObjectURL(file));
        setCoverStoragePath(result.storagePath);
        setCoverMimeType(result.mimeType);
        setRemoveCover(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload fehlgeschlagen.");
      } finally {
        setUploading(false);
      }
    },
    [restaurantId, item?.eventId, coverPreview],
  );

  const clearCover = () => {
    if (coverPreview?.startsWith("blob:")) URL.revokeObjectURL(coverPreview);
    setCoverPreview(null);
    setCoverStoragePath(null);
    setCoverMimeType(null);
    setRemoveCover(true);
  };

  const save = useCallback(async () => {
    if (!item?.eventId) return;
    if (!title.trim()) {
      toast.error("Bitte Titel eingeben.");
      return;
    }
    const startAt = combineDateTime(startDate, startTime);
    if (!startAt) {
      toast.error("Bitte Startdatum und -zeit angeben.");
      return;
    }
    const endAt =
      endDate && endTime ? combineDateTime(endDate, endTime) : endDate ? combineDateTime(endDate, "23:59") : null;

    setSaving(true);
    try {
      const res = await fetch(`/api/events/items/${item.eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          title: title.trim(),
          description: description.trim(),
          startAt,
          endAt,
          ticketUrl: ticketUrl.trim() || null,
          location: location.trim() || null,
          coverStoragePath,
          coverMimeType,
          removeCover,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "save_failed");
      toast.success("Event gespeichert.");
      onOpenChange(false);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }, [
    item?.eventId,
    title,
    description,
    startDate,
    startTime,
    endDate,
    endTime,
    ticketUrl,
    location,
    coverStoragePath,
    coverMimeType,
    removeCover,
    restaurantId,
    onOpenChange,
    onChanged,
  ]);

  const deleteEvent = useCallback(async () => {
    if (!item || !confirm("Event wirklich löschen?")) return;
    setDeleting(true);
    try {
      const params = new URLSearchParams({ restaurantId });
      if (item.source === "external" && item.platform !== "gwada") {
        const externalId = item.id.split(":").slice(1).join(":");
        params.set("platform", item.platform);
        params.set("externalId", externalId);
      }
      const res = await fetch(
        `/api/events/items/${item.eventId ?? "external"}?${params}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "delete_failed");
      toast.success("Event gelöscht.");
      onOpenChange(false);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Löschen fehlgeschlagen.");
    } finally {
      setDeleting(false);
    }
  }, [item, restaurantId, onOpenChange, onChanged]);

  if (!item) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent className={drawerContentClassName("mediaTall")}>
        <DrawerHeader>
          <DrawerTitle>{isGwadaEditable ? "Event bearbeiten" : item.title}</DrawerTitle>
        </DrawerHeader>
        <div className={drawerScrollAreaClassName(4)}>
          {isGwadaEditable ? (
            <>
              <DrawerFormSection contentPadding={4} title="Inhalt">
              <div className="space-y-2">
                <Label htmlFor="events-edit-title">Titel</Label>
                <Input
                  id="events-edit-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="events-edit-description">Beschreibung</Label>
                <Textarea
                  id="events-edit-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                />
              </div>
              </DrawerFormSection>

              <DrawerFormSection contentPadding={4} title="Termin">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Startdatum</Label>
                  <DatePickerField
                    value={startDate || null}
                    onChange={(v) => setStartDate(v ?? "")}
                    fullWidth
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="events-edit-start-time">Startzeit</Label>
                  <Input
                    id="events-edit-start-time"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className={formScheduleTimeInputClassName}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Enddatum (optional)</Label>
                  <DatePickerField
                    value={endDate || null}
                    onChange={(v) => setEndDate(v ?? "")}
                    minYmd={startDate || undefined}
                    fullWidth
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="events-edit-end-time">Endzeit (optional)</Label>
                  <Input
                    id="events-edit-end-time"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className={formScheduleTimeInputClassName}
                  />
                </div>
              </div>
              </DrawerFormSection>

              <DrawerFormSection contentPadding={4} title="Details">
              <div className="space-y-2">
                <Label htmlFor="events-edit-location">Ort (optional)</Label>
                <Input
                  id="events-edit-location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="events-edit-ticket">Ticket-Link (optional)</Label>
                <Input
                  id="events-edit-ticket"
                  type="url"
                  value={ticketUrl}
                  onChange={(e) => setTicketUrl(e.target.value)}
                  placeholder="https://…"
                />
              </div>
              </DrawerFormSection>

              <DrawerFormSection contentPadding={4} title="Titelbild">
              <div className="space-y-2">
                <Label>Titelbild (optional)</Label>
                {coverPreview ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={coverPreview}
                      alt=""
                      className="max-h-40 w-full rounded-xl object-cover"
                    />
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="secondary"
                      className="absolute right-2 top-2"
                      onClick={clearCover}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={uploading}
                    onClick={() => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept = "image/jpeg,image/png,image/webp";
                      input.onchange = () => {
                        const file = input.files?.[0];
                        if (file) void uploadCover(file);
                      };
                      input.click();
                    }}
                  >
                    <Upload className="size-4" />
                    {uploading ? "Wird hochgeladen …" : "Bild hochladen"}
                  </Button>
                )}
              </div>
              </DrawerFormSection>

              {canManage ? (
                <DrawerFormSection contentPadding={4} title="Aktionen">
                <FeedPinButton
                  restaurantId={restaurantId}
                  module="events"
                  platform={item.platform}
                  itemId={item.id}
                  isPinned={Boolean(item.isPinned)}
                  onChanged={(nextPinned) => onChanged(nextPinned)}
                />
                </DrawerFormSection>
              ) : null}
            </>
          ) : (
            <>
              {item.coverUrl ? (
                <DrawerFormSection contentPadding={4}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.coverUrl}
                  alt=""
                  className="max-h-48 w-full rounded-xl object-cover"
                />
                </DrawerFormSection>
              ) : null}
              <DrawerFormSection contentPadding={4} title="Details">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="gap-1.5">
                  <EventsPlatformIcon platform={item.platform} className="size-3" />
                  {EVENTS_PLATFORM_LABELS[item.platform]}
                </Badge>
                <time className="text-sm text-muted-foreground" dateTime={item.startAt}>
                  {formatEventDateRange(item)}
                </time>
              </div>
              {item.description ? (
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {item.description}
                </p>
              ) : null}
              {item.location ? <p className="text-sm">📍 {item.location}</p> : null}
              <EventsDetailActions item={item} />
              </DrawerFormSection>
              {canManage ? (
                <DrawerFormSection contentPadding={4} title="Aktionen">
                <FeedPinButton
                  restaurantId={restaurantId}
                  module="events"
                  platform={item.platform}
                  itemId={item.id}
                  isPinned={Boolean(item.isPinned)}
                  onChanged={(nextPinned) => onChanged(nextPinned)}
                />
                </DrawerFormSection>
              ) : null}
            </>
          )}
        </div>
        {isGwadaEditable ? (
          <DrawerFormFooter
            onCancel={() => onOpenChange(false)}
            onSubmit={() => void save()}
            submitType="button"
            submitLabel="Speichern"
            submitPending={saving}
            showDelete={item.canDelete}
            onDelete={() => void deleteEvent()}
            deleteDisabled={deleting}
          />
        ) : canManage && item.canDelete ? (
          <DrawerFooter>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={() => void deleteEvent()}
            >
              <Trash2 className="size-4" />
              Löschen
            </Button>
          </DrawerFooter>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}
