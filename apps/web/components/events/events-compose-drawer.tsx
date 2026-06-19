"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  DatePickerField,
  formScheduleTimeInputClassName,
} from "@/components/ui/date-picker";
import { EventsPlatformChip } from "@/components/events/events-platform-filter-chips";
import type { EventsPlatform } from "@/lib/constants/events-platforms";
import { uploadEventsMedia } from "@/lib/events/events-media-api";
import { validateEventsMediaFile } from "@/lib/events/validate-events-media-file";
import type { EventsConnectorPublicInfo } from "@/lib/types/events-connectors";
import { cn } from "@/lib/utils";

function combineDateTime(dateYmd: string, time: string): string | null {
  if (!dateYmd || !time) return null;
  const iso = new Date(`${dateYmd}T${time}:00`).toISOString();
  return Number.isNaN(new Date(iso).getTime()) ? null : iso;
}

export function EventsComposeDrawer({
  open,
  onOpenChange,
  restaurantId,
  connectors,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  connectors: EventsConnectorPublicInfo[];
  onSaved: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const eventIdRef = useRef<string>("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("19:00");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [ticketUrl, setTicketUrl] = useState("");
  const [location, setLocation] = useState("");
  const [platforms, setPlatforms] = useState<EventsPlatform[]>(["gwada"]);
  const [postToInstagram, setPostToInstagram] = useState(false);
  const [postToWhatsapp, setPostToWhatsapp] = useState(false);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverStoragePath, setCoverStoragePath] = useState<string | null>(null);
  const [coverMimeType, setCoverMimeType] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription("");
    setStartDate("");
    setStartTime("19:00");
    setEndDate("");
    setEndTime("");
    setTicketUrl("");
    setLocation("");
    setPlatforms(["gwada"]);
    setPostToInstagram(false);
    setPostToWhatsapp(false);
    setCoverPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setCoverStoragePath(null);
    setCoverMimeType(null);
    eventIdRef.current = crypto.randomUUID();
  }, [open]);

  const nativeConnectors = connectors.filter(
    (c) =>
      c.connected &&
      c.capabilities.canCreateEvent &&
      !c.capabilities.isAnnouncementOnly,
  );
  const igConnected = connectors.some(
    (c) => c.key === "instagram" && c.connected && c.capabilities.canCreateEvent,
  );
  const waConnected = connectors.some(
    (c) =>
      c.key === "whatsapp_channel" && c.connected && c.capabilities.canCreateEvent,
  );

  const togglePlatform = (key: EventsPlatform) => {
    setPlatforms((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key],
    );
  };

  const uploadCover = useCallback(
    async (file: File) => {
      const err = validateEventsMediaFile(file);
      if (err) {
        toast.error(err);
        return;
      }
      if (!eventIdRef.current) eventIdRef.current = crypto.randomUUID();
      setUploading(true);
      try {
        const result = await uploadEventsMedia({
          restaurantId,
          eventId: eventIdRef.current,
          file,
        });
        if ("error" in result) throw new Error(result.error);
        if (coverPreview) URL.revokeObjectURL(coverPreview);
        setCoverPreview(URL.createObjectURL(file));
        setCoverStoragePath(result.storagePath);
        setCoverMimeType(result.mimeType);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload fehlgeschlagen.");
      } finally {
        setUploading(false);
      }
    },
    [restaurantId, coverPreview],
  );

  const removeCover = () => {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverPreview(null);
    setCoverStoragePath(null);
    setCoverMimeType(null);
  };

  const save = useCallback(async () => {
    if (!title.trim()) {
      toast.error("Bitte Titel eingeben.");
      return;
    }
    const startAt = combineDateTime(startDate, startTime);
    if (!startAt) {
      toast.error("Bitte Startdatum und -uhrzeit angeben.");
      return;
    }
    const endAt =
      endDate && endTime ? combineDateTime(endDate, endTime) : endDate ? combineDateTime(endDate, startTime) : null;
    if (endAt && new Date(endAt) < new Date(startAt)) {
      toast.error("Endzeit muss nach Startzeit liegen.");
      return;
    }
    if (postToInstagram && !coverStoragePath) {
      toast.error("Instagram-Post benötigt ein Titelbild.");
      return;
    }
    if (!eventIdRef.current) eventIdRef.current = crypto.randomUUID();
    setSaving(true);
    try {
      const res = await fetch("/api/events/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          eventId: eventIdRef.current,
          title: title.trim(),
          description: description.trim(),
          startAt,
          endAt,
          ticketUrl: ticketUrl.trim() || null,
          location: location.trim() || null,
          coverStoragePath,
          coverMimeType,
          platforms,
          postToInstagram,
          postToWhatsapp,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "save_failed");
      toast.success("Event veröffentlicht.");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }, [
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
    platforms,
    postToInstagram,
    postToWhatsapp,
    restaurantId,
    onOpenChange,
    onSaved,
  ]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent className="max-h-[92dvh]">
        <DrawerHeader>
          <DrawerTitle>Neues Event</DrawerTitle>
        </DrawerHeader>
        <div className="space-y-4 overflow-y-auto px-4 pb-2">
          <div className="space-y-2">
            <Label htmlFor="event-title">Titel</Label>
            <Input
              id="event-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Live-Musik, Weinprobe …"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="event-description">Beschreibung</Label>
            <Textarea
              id="event-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Details zum Event …"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Start</Label>
              <div className="flex flex-wrap items-center gap-2">
                <DatePickerField
                  value={startDate || null}
                  onChange={(v) => setStartDate(v ?? "")}
                  fullWidth
                  className="min-w-0 flex-1"
                />
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className={formScheduleTimeInputClassName}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Ende (optional)</Label>
              <div className="flex flex-wrap items-center gap-2">
                <DatePickerField
                  value={endDate || null}
                  onChange={(v) => setEndDate(v ?? "")}
                  fullWidth
                  className="min-w-0 flex-1"
                  minYmd={startDate || undefined}
                />
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className={formScheduleTimeInputClassName}
                />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="event-ticket">Ticketlink</Label>
            <Input
              id="event-ticket"
              type="url"
              value={ticketUrl}
              onChange={(e) => setTicketUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="event-location">Ort (optional)</Label>
            <Input
              id="event-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Terrasse, Saal …"
            />
          </div>
          <div className="space-y-2">
            <Label>Titelbild</Label>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadCover(file);
                e.target.value = "";
              }}
            />
            {coverPreview ? (
              <div className="relative overflow-hidden rounded-xl border border-border/50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={coverPreview} alt="" className="max-h-40 w-full object-cover" />
                <Button
                  type="button"
                  size="icon-sm"
                  variant="secondary"
                  className="absolute top-2 right-2"
                  onClick={removeCover}
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
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="size-4" />
                Bild hochladen
              </Button>
            )}
          </div>
          <div className="space-y-2">
            <Label>Plattformen</Label>
            <div className="flex flex-wrap gap-2">
              <EventsPlatformChip
                platform="gwada"
                selected={platforms.includes("gwada")}
                onSelect={() => togglePlatform("gwada")}
              />
              {nativeConnectors.map((c) => (
                <EventsPlatformChip
                  key={c.key}
                  platform={c.key}
                  selected={platforms.includes(c.key)}
                  onSelect={() => togglePlatform(c.key)}
                />
              ))}
            </div>
          </div>
          {(igConnected || waConnected) && (
            <div className="space-y-3 rounded-xl border border-border/50 p-3">
              <p className="text-sm font-medium">Zusätzlich ankündigen</p>
              {igConnected ? (
                <label className="flex cursor-pointer items-center gap-2">
                  <Checkbox
                    checked={postToInstagram}
                    onCheckedChange={(v) => setPostToInstagram(v === true)}
                  />
                  <span className="text-sm">Instagram-Post erstellen</span>
                </label>
              ) : null}
              {waConnected ? (
                <label className="flex cursor-pointer items-center gap-2">
                  <Checkbox
                    checked={postToWhatsapp}
                    onCheckedChange={(v) => setPostToWhatsapp(v === true)}
                  />
                  <span className="text-sm">WhatsApp-Kanal-Nachricht erstellen</span>
                </label>
              ) : null}
            </div>
          )}
        </div>
        <DrawerFooter>
          <DrawerFormFooter
            onCancel={() => onOpenChange(false)}
            onSubmit={() => void save()}
            submitLabel="Veröffentlichen"
            submitPending={saving}
            submitDisabled={uploading}
          />
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
