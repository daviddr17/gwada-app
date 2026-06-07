"use client";

import { Camera, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadUserProfileImageClient } from "@/lib/profile/user-profile-image-client";
import {
  resolveUserProfileImageSignedUrl,
  type UserProfileImageKind,
} from "@/lib/profile/user-profile-image";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  profileAvatarFallbackPlateClassName,
  profileAvatarHeaderFrameClassName,
  profileAvatarImageClassName,
} from "@/lib/ui/profile-avatar-image";
import { cn } from "@/lib/utils";

const ACCEPT = "image/jpeg,image/png,image/webp";

function profileInitials(firstName: string, lastName: string): string {
  const fi = firstName.trim();
  const la = lastName.trim();
  const a = fi.slice(0, 1).toLocaleUpperCase("de-DE");
  const b = la.slice(0, 1).toLocaleUpperCase("de-DE");
  if (a && b) return a + b;
  if (a && fi.length >= 2) return a + fi.slice(1, 2).toLocaleUpperCase("de-DE");
  if (a) return `${a}?`;
  if (b && la.length >= 2) {
    return (
      la.slice(0, 1).toLocaleUpperCase("de-DE") +
      la.slice(1, 2).toLocaleUpperCase("de-DE")
    );
  }
  if (b) return `?${b}`;
  return "?";
}

function uploadErrorMessage(kind: UserProfileImageKind, code?: string): string {
  if (code === "invalid_file") {
    return "Nur JPEG-, PNG- oder WebP-Bilder bis 5 MB sind erlaubt.";
  }
  return kind === "avatar"
    ? "Profilbild konnte nicht hochgeladen werden."
    : "Titelbild konnte nicht hochgeladen werden.";
}

type PersonalProfileHeaderProps = {
  userId: string | null;
  firstName: string;
  lastName: string;
  nickname: string;
  avatarStoragePath: string | null;
  coverStoragePath: string | null;
  onFirstNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
  onNicknameChange: (value: string) => void;
  onImagePathsChange: (paths: {
    avatarStoragePath?: string | null;
    coverStoragePath?: string | null;
  }) => void;
  disabled?: boolean;
};

export function PersonalProfileHeader({
  userId,
  firstName,
  lastName,
  nickname,
  avatarStoragePath,
  coverStoragePath,
  onFirstNameChange,
  onLastNameChange,
  onNicknameChange,
  onImagePathsChange,
  disabled = false,
}: PersonalProfileHeaderProps) {
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [avatarLocalPreview, setAvatarLocalPreview] = useState<string | null>(null);
  const [coverLocalPreview, setCoverLocalPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);

  const initials = useMemo(
    () => profileInitials(firstName, lastName),
    [firstName, lastName],
  );
  const canUpload = Boolean(userId) && !disabled;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!avatarStoragePath) {
        if (!cancelled) setAvatarUrl(null);
        return;
      }
      const url = await resolveUserProfileImageSignedUrl(
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
      const url = await resolveUserProfileImageSignedUrl(
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
    kind: UserProfileImageKind,
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
      const { path, error } = await uploadUserProfileImageClient({ kind, file });

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
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <button
            type="button"
            disabled={!canUpload || avatarUploading}
            className={cn(
              profileAvatarHeaderFrameClassName,
              "group -mt-12 size-24 sm:-mt-14",
              !avatarDisplayUrl && profileAvatarFallbackPlateClassName,
            )}
            onClick={() => avatarInputRef.current?.click()}
            aria-label="Profilbild ändern"
          >
            {avatarDisplayUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarDisplayUrl}
                alt=""
                className={profileAvatarImageClassName}
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
              <Label htmlFor="profile-nickname">Nickname</Label>
              <Input
                id="profile-nickname"
                autoComplete="nickname"
                disabled={disabled}
                value={nickname}
                onChange={(e) => onNicknameChange(e.target.value)}
                placeholder="z. B. tech-lion"
                className="h-11 max-w-xl rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="profile-first">Vorname</Label>
                <Input
                  id="profile-first"
                  autoComplete="given-name"
                  disabled={disabled}
                  value={firstName}
                  onChange={(e) => onFirstNameChange(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-last">Nachname</Label>
                <Input
                  id="profile-last"
                  autoComplete="family-name"
                  disabled={disabled}
                  value={lastName}
                  onChange={(e) => onLastNameChange(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
