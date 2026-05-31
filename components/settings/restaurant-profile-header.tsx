"use client";

import { Camera, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadRestaurantProfileImageClient } from "@/lib/restaurant/restaurant-profile-image-client";
import {
  resolveRestaurantProfileImageSignedUrl,
  type RestaurantProfileImageKind,
} from "@/lib/restaurant/restaurant-profile-image";
import {
  restaurantLogoHeaderFrameClassName,
  restaurantLogoImageClassName,
  restaurantLogoPlateClassName,
} from "@/lib/ui/profile-avatar-image";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { cn } from "@/lib/utils";

const ACCEPT = "image/jpeg,image/png,image/webp";

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
}: RestaurantProfileHeaderProps) {
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [avatarLocalPreview, setAvatarLocalPreview] = useState<string | null>(null);
  const [coverLocalPreview, setCoverLocalPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);

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
      const { path, error } = await uploadRestaurantProfileImageClient({
        restaurantId,
        kind,
        file,
      });

      if (error || !path) {
        toast.error(uploadErrorMessage(kind, error));
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
        className="group relative block h-36 w-full overflow-hidden bg-muted md:h-44"
        onClick={() => coverInputRef.current?.click()}
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
        <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 group-disabled:opacity-0">
          {coverUploading ? (
            <Loader2 className="size-7 animate-spin text-white" aria-hidden />
          ) : (
            <Camera className="size-7 text-white" aria-hidden />
          )}
        </span>
      </button>

      <div className="relative px-5 pb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <button
              type="button"
              disabled={!canUpload || avatarUploading}
              className={cn(
                restaurantLogoHeaderFrameClassName,
                restaurantLogoPlateClassName,
                "group -mt-12 size-24 sm:-mt-14",
              )}
              onClick={() => avatarInputRef.current?.click()}
              aria-label="Profilbild ändern"
            >
              {avatarDisplayUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarDisplayUrl}
                  alt=""
                  className={restaurantLogoImageClassName}
                />
              ) : (
                <span className="text-2xl font-semibold text-muted-foreground">
                  {initials}
                </span>
              )}
              <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 group-disabled:opacity-0">
                {avatarUploading ? (
                  <Loader2 className="size-6 animate-spin text-white" aria-hidden />
                ) : (
                  <Camera className="size-6 text-white" aria-hidden />
                )}
              </span>
            </button>

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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
