"use client";

import { Camera, IdCard } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RestaurantLogoMark } from "@/components/ui/restaurant-logo-mark";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadRestaurantProfileImageClient } from "@/lib/restaurant/restaurant-profile-image-client";
import {
  resolveRestaurantProfileImageSignedUrl,
  type RestaurantProfileImageKind,
} from "@/lib/restaurant/restaurant-profile-image";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { trackDashboardFileUpload } from "@/lib/uploads/dashboard-file-upload";
import { cn } from "@/lib/utils";

const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_PROFILE_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const ALLOWED_PROFILE_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);

function validateProfileImageFile(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase();
  const mimeOk = file.type
    ? ALLOWED_PROFILE_IMAGE_MIMES.has(file.type)
    : Boolean(ext && ALLOWED_PROFILE_IMAGE_EXTENSIONS.has(ext));
  if (!mimeOk) {
    return "Nur JPEG-, PNG- oder WebP-Bilder bis 5 MB sind erlaubt.";
  }
  if (file.size <= 0 || file.size > MAX_PROFILE_IMAGE_BYTES) {
    return "Nur JPEG-, PNG- oder WebP-Bilder bis 5 MB sind erlaubt.";
  }
  return null;
}

function restaurantInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (
      parts[0]!.slice(0, 1).toLocaleUpperCase("de-DE") +
      parts[1]!.slice(0, 1).toLocaleUpperCase("de-DE")
    );
  }
  const single = name.trim().slice(0, 2).toLocaleUpperCase("de-DE");
  return single || "?";
}

function uploadErrorMessage(kind: RestaurantProfileImageKind, code?: string): string {
  if (code === "invalid_file") {
    return "Nur JPEG-, PNG- oder WebP-Bilder bis 5 MB sind erlaubt.";
  }
  return kind === "avatar"
    ? "Profilbild konnte nicht hochgeladen werden."
    : "Titelbild konnte nicht hochgeladen werden.";
}

type RestaurantProfileHeaderProps = {
  restaurantId: string;
  name: string;
  slug: string;
  avatarStoragePath: string | null;
  coverStoragePath: string | null;
  onNameChange: (name: string) => void;
  onSlugChange: (slug: string) => void;
  onImagePathsChange: (paths: {
    avatarStoragePath?: string | null;
    coverStoragePath?: string | null;
  }) => void;
  onCreateBusinessCard?: () => void;
};

export function RestaurantProfileHeader({
  restaurantId,
  name,
  slug,
  avatarStoragePath,
  coverStoragePath,
  onNameChange,
  onSlugChange,
  onImagePathsChange,
  onCreateBusinessCard,
}: RestaurantProfileHeaderProps) {
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const avatarDragDepthRef = useRef(0);
  const coverDragDepthRef = useRef(0);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [avatarLocalPreview, setAvatarLocalPreview] = useState<string | null>(null);
  const [coverLocalPreview, setCoverLocalPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [isAvatarDragOver, setIsAvatarDragOver] = useState(false);
  const [isCoverDragOver, setIsCoverDragOver] = useState(false);

  const initials = useMemo(() => restaurantInitials(name), [name]);
  const canUpload = isUuidRestaurantId(restaurantId);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!avatarStoragePath) {
        if (!cancelled) setAvatarUrl(null);
        return;
      }
      const url = await resolveRestaurantProfileImageSignedUrl(
        createSupabaseBrowserClient(),
        avatarStoragePath,
      );
      if (!cancelled) setAvatarUrl(url);
    })();
    return () => {
      cancelled = true;
    };
  }, [avatarStoragePath]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!coverStoragePath) {
        if (!cancelled) setCoverUrl(null);
        return;
      }
      const url = await resolveRestaurantProfileImageSignedUrl(
        createSupabaseBrowserClient(),
        coverStoragePath,
      );
      if (!cancelled) setCoverUrl(url);
    })();
    return () => {
      cancelled = true;
    };
  }, [coverStoragePath]);

  const avatarDisplayUrl = avatarLocalPreview ?? avatarUrl;
  const coverDisplayUrl = coverLocalPreview ?? coverUrl;

  const handleFileSelect = async (
    kind: RestaurantProfileImageKind,
    file: File | undefined,
  ) => {
    if (!file || !canUpload) return;

    const setLocalPreview =
      kind === "avatar" ? setAvatarLocalPreview : setCoverLocalPreview;
    const setUploading = kind === "avatar" ? setAvatarUploading : setCoverUploading;
    const inputRef = kind === "avatar" ? avatarInputRef : coverInputRef;

    const previewUrl = URL.createObjectURL(file);
    setLocalPreview(previewUrl);
    setUploading(true);

    try {
      const { path, error } = await trackDashboardFileUpload(
        () =>
          uploadRestaurantProfileImageClient({
            restaurantId,
            kind,
            file,
          }),
        {
          successMessage:
            kind === "avatar" ? "Logo hochgeladen." : "Titelbild hochgeladen.",
          errorMessage: (code) => uploadErrorMessage(kind, code),
        },
      );

      if (error || !path) {
        setLocalPreview(null);
        return;
      }

      if (kind === "avatar") {
        onImagePathsChange({ avatarStoragePath: path });
      } else {
        onImagePathsChange({ coverStoragePath: path });
      }
    } finally {
      setUploading(false);
      URL.revokeObjectURL(previewUrl);
      setLocalPreview(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleCoverDragEnter = useCallback((e: React.DragEvent) => {
    if (!canUpload || coverUploading) return;
    e.preventDefault();
    e.stopPropagation();
    coverDragDepthRef.current += 1;
    if (e.dataTransfer.types.includes("Files")) {
      setIsCoverDragOver(true);
    }
  }, [canUpload, coverUploading]);

  const handleCoverDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    coverDragDepthRef.current = Math.max(0, coverDragDepthRef.current - 1);
    if (coverDragDepthRef.current === 0) {
      setIsCoverDragOver(false);
    }
  }, []);

  const handleCoverDragOver = useCallback((e: React.DragEvent) => {
    if (!canUpload || coverUploading) return;
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  }, [canUpload, coverUploading]);

  const handleCoverDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      coverDragDepthRef.current = 0;
      setIsCoverDragOver(false);
      if (!canUpload || coverUploading) return;
      const dropped = e.dataTransfer.files?.[0];
      if (!dropped) return;
      const err = validateProfileImageFile(dropped);
      if (err) {
        toast.error(err);
        return;
      }
      void handleFileSelect("cover", dropped);
    },
    [canUpload, coverUploading],
  );

  const handleAvatarDragEnter = useCallback((e: React.DragEvent) => {
    if (!canUpload || avatarUploading) return;
    e.preventDefault();
    e.stopPropagation();
    avatarDragDepthRef.current += 1;
    if (e.dataTransfer.types.includes("Files")) {
      setIsAvatarDragOver(true);
    }
  }, [canUpload, avatarUploading]);

  const handleAvatarDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    avatarDragDepthRef.current = Math.max(0, avatarDragDepthRef.current - 1);
    if (avatarDragDepthRef.current === 0) {
      setIsAvatarDragOver(false);
    }
  }, []);

  const handleAvatarDragOver = useCallback((e: React.DragEvent) => {
    if (!canUpload || avatarUploading) return;
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  }, [canUpload, avatarUploading]);

  const handleAvatarDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      avatarDragDepthRef.current = 0;
      setIsAvatarDragOver(false);
      if (!canUpload || avatarUploading) return;
      const dropped = e.dataTransfer.files?.[0];
      if (!dropped) return;
      const err = validateProfileImageFile(dropped);
      if (err) {
        toast.error(err);
        return;
      }
      void handleFileSelect("avatar", dropped);
    },
    [canUpload, avatarUploading],
  );

  return (
    <div className="overflow-hidden rounded-xl border border-border/50 bg-muted/20 shadow-card">
      <input
        ref={coverInputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(e) => void handleFileSelect("cover", e.target.files?.[0])}
      />
      <input
        ref={avatarInputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(e) => void handleFileSelect("avatar", e.target.files?.[0])}
      />

      <button
        type="button"
        disabled={!canUpload || coverUploading}
        className={cn(
          "group relative block h-36 w-full overflow-hidden bg-muted md:h-44",
          isCoverDragOver && "ring-2 ring-inset ring-accent",
        )}
        onClick={() => coverInputRef.current?.click()}
        onDragEnter={handleCoverDragEnter}
        onDragLeave={handleCoverDragLeave}
        onDragOver={handleCoverDragOver}
        onDrop={handleCoverDrop}
        aria-label="Titelbild ändern"
      >
        {coverDisplayUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverDisplayUrl}
            alt=""
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-gradient-to-br from-muted/80 to-muted/30">
            <span className="text-sm text-muted-foreground">Titelbild hinzufügen</span>
          </div>
        )}
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity group-disabled:opacity-60",
            isCoverDragOver ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
        >
          <Camera className="size-7 text-white" aria-hidden />
        </span>
      </button>

      <div className="relative px-5 pb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="relative w-fit sm:-mt-14 -mt-12">
              <button
                type="button"
                disabled={!canUpload || avatarUploading}
                className={cn(
                  "group relative block rounded-full",
                  isAvatarDragOver && "ring-2 ring-accent ring-offset-2 ring-offset-card",
                )}
                onClick={() => avatarInputRef.current?.click()}
                onDragEnter={handleAvatarDragEnter}
                onDragLeave={handleAvatarDragLeave}
                onDragOver={handleAvatarDragOver}
                onDrop={handleAvatarDrop}
                aria-label="Profilbild ändern"
              >
                <RestaurantLogoMark
                  src={avatarDisplayUrl}
                  initials={initials}
                  alt=""
                  size="header"
                  variant="header"
                />
                <span
                  className={cn(
                    "absolute inset-0 flex items-center justify-center rounded-full bg-black/40 transition-opacity group-disabled:opacity-60",
                    isAvatarDragOver
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100",
                  )}
                >
                  <Camera className="size-6 text-white" aria-hidden />
                </span>
              </button>
            </div>

            <div className="space-y-3 pt-1">
              <div className="space-y-2">
                <Label htmlFor="rs-nickname">Nickname</Label>
                <Input
                  id="rs-nickname"
                  value={slug}
                  onChange={(e) => onSlugChange(e.target.value)}
                  placeholder="z. B. gwada-soul-kitchen"
                  className="h-11 max-w-xl rounded-xl font-mono text-sm"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rs-name">Name</Label>
                <Input
                  id="rs-name"
                  value={name}
                  onChange={(e) => onNameChange(e.target.value)}
                  placeholder="z. B. Gwada Soul Kitchen"
                  className="h-11 max-w-xl rounded-xl"
                />
              </div>
              {onCreateBusinessCard ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2 rounded-full border-border/60"
                    onClick={onCreateBusinessCard}
                  >
                    <IdCard className="size-4" aria-hidden />
                    Visitenkarte erstellen
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
