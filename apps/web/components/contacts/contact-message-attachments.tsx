"use client";

import { useEffect, useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ContactMessageVideoPlayer } from "@/components/contacts/contact-message-video-player";
import { ContactMessageVoicePlayer } from "@/components/contacts/contact-message-voice-player";
import { Skeleton } from "@/components/ui/skeleton";
import { downloadContactAttachmentClient } from "@/lib/contact-messages/download-attachment-client";
import {
  isGenericAttachmentDisplayName,
  rememberAttachmentDisplayName,
  resolveWahaAttachmentDisplayName,
} from "@/lib/contact-messages/resolve-attachment-display-name";
import type { ContactMessageAttachment } from "@/lib/types/contact-message-attachment";
import { cn } from "@/lib/utils";

/** WhatsApp & Gwada: volle Bubble-Breite, höhere Vorschau. */
export const contactMessageAttachmentImageDefaultClassName =
  "max-h-56 w-full object-cover";

/** E-Mail: Logos/Signaturen klein halten, Seitenverhältnis erhalten. */
export const contactMessageAttachmentImageEmailClassName =
  "mx-auto h-auto max-h-36 w-auto max-w-[min(100%,12rem)] object-contain";


/** Reservierte Höhe für Chat-Bildvorschau (vermeidet leere Bubble bis onLoad). */
const CONTACT_MESSAGE_IMAGE_SKELETON_DEFAULT_CLASS =
  "h-44 w-full max-h-56 rounded-lg";
const CONTACT_MESSAGE_IMAGE_SKELETON_EMAIL_CLASS =
  "mx-auto h-28 w-44 max-w-[min(100%,12rem)] rounded-lg";

function ContactMessageAttachmentImage({
  attachment,
  imageClassName,
  imageLinkClassName,
  variant,
}: {
  attachment: ContactMessageAttachment;
  imageClassName: string;
  imageLinkClassName: string;
  variant: "default" | "email";
}) {
  const url = attachment.url.trim();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
  }, [url]);

  const finish = () => {
    setLoaded(true);
    window.dispatchEvent(
      new CustomEvent("gwada:contact-chat-content-layout"),
    );
  };

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(imageLinkClassName, "relative")}
    >
      {!loaded ? (
        <Skeleton
          aria-hidden
          className={
            variant === "email"
              ? CONTACT_MESSAGE_IMAGE_SKELETON_EMAIL_CLASS
              : CONTACT_MESSAGE_IMAGE_SKELETON_DEFAULT_CLASS
          }
        />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={attachment.fileName}
        className={cn(
          imageClassName,
          "transition-opacity duration-200 ease-out",
          loaded
            ? "relative opacity-100"
            : "absolute inset-0 size-full opacity-0",
        )}
        loading="lazy"
        decoding="async"
        onLoad={finish}
        onError={finish}
      />
    </a>
  );
}

function formatByteSize(bytes: number | null | undefined): string | null {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentDownloadChip({
  attachment,
  outbound,
}: {
  attachment: ContactMessageAttachment;
  outbound?: boolean;
}) {
  const fallbackName = attachment.fileName?.trim() || "Datei";
  const [displayName, setDisplayName] = useState(fallbackName);
  const [busy, setBusy] = useState(false);
  const sizeLabel = formatByteSize(attachment.byteSize ?? null);

  useEffect(() => {
    setDisplayName(fallbackName);
  }, [fallbackName, attachment.url]);

  useEffect(() => {
    const url = attachment.url?.trim();
    if (!url?.includes("/waha/media")) return;
    if (!isGenericAttachmentDisplayName(fallbackName)) return;

    let cancelled = false;
    void resolveWahaAttachmentDisplayName(url).then((name) => {
      if (cancelled || !name) return;
      setDisplayName(name);
    });
    return () => {
      cancelled = true;
    };
  }, [attachment.url, fallbackName]);

  const onDownload = async () => {
    const url = attachment.url?.trim();
    if (!url || busy) return;
    setBusy(true);
    const result = await downloadContactAttachmentClient({
      url,
      fileName: displayName || fallbackName,
    });
    setBusy(false);
    if (!result.ok) {
      toast.error("Datei konnte nicht geladen werden.");
      return;
    }
    if (result.fileName) {
      rememberAttachmentDisplayName(url, result.fileName);
      setDisplayName(result.fileName);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void onDownload()}
      disabled={busy || !attachment.url?.trim()}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors",
        outbound
          ? "border-accent-foreground/25 bg-accent-foreground/10 hover:bg-accent-foreground/15"
          : "border-border/50 bg-background/80 hover:bg-muted/50",
        (busy || !attachment.url?.trim()) && "opacity-70",
      )}
    >
      <FileText className="size-4 shrink-0 opacity-70" aria-hidden />
      <span className="min-w-0 flex-1 truncate font-medium">
        {displayName}
      </span>
      {sizeLabel ? (
        <span className="shrink-0 text-muted-foreground">{sizeLabel}</span>
      ) : null}
      {busy ? (
        <Loader2 className="size-3.5 shrink-0 animate-spin opacity-60" aria-hidden />
      ) : (
        <Download className="size-3.5 shrink-0 opacity-60" aria-hidden />
      )}
    </button>
  );
}

export function ContactMessageAttachments({
  attachments,
  outbound,
  className,
  variant = "default",
}: {
  attachments: ContactMessageAttachment[];
  outbound?: boolean;
  className?: string;
  /** E-Mail-Anhänge (z. B. Firmenlogos) kompakter begrenzen. */
  variant?: "default" | "email";
}) {
  if (attachments.length === 0) return null;

  const imageClassName =
    variant === "email"
      ? contactMessageAttachmentImageEmailClassName
      : contactMessageAttachmentImageDefaultClassName;
  const imageLinkClassName =
    variant === "email"
      ? "inline-flex max-w-full overflow-hidden rounded-lg border border-border/40"
      : "block overflow-hidden rounded-lg border border-border/40";

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {attachments.map((a) => {
        if (a.kind === "voice") {
          return (
            <ContactMessageVoicePlayer
              key={a.id}
              url={a.url}
              outbound={outbound}
              durationSeconds={a.durationSeconds}
            />
          );
        }

        if (a.kind === "video") {
          return (
            <ContactMessageVideoPlayer
              key={a.id}
              url={a.url}
              fileName={a.fileName}
            />
          );
        }

        if (a.kind === "image") {
          // IMAP: Bytes erst bei Klick (Privacy/Traffic). WhatsApp/Storage: Inline-Vorschau.
          if (a.loadOnClick || !a.url?.trim()) {
            return (
              <AttachmentDownloadChip
                key={a.id}
                attachment={a}
                outbound={outbound}
              />
            );
          }

          return (
            <ContactMessageAttachmentImage
              key={a.id}
              attachment={a}
              imageClassName={imageClassName}
              imageLinkClassName={imageLinkClassName}
              variant={variant}
            />
          );
        }

        return (
          <AttachmentDownloadChip
            key={a.id}
            attachment={a}
            outbound={outbound}
          />
        );
      })}
    </div>
  );
}
