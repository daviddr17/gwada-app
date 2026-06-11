"use client";

import { Download, FileText } from "lucide-react";
import { ContactMessageVideoPlayer } from "@/components/contacts/contact-message-video-player";
import { ContactMessageVoicePlayer } from "@/components/contacts/contact-message-voice-player";
import type { ContactMessageAttachment } from "@/lib/types/contact-message-attachment";
import { cn } from "@/lib/utils";

/** WhatsApp & Gwada: volle Bubble-Breite, höhere Vorschau. */
export const contactMessageAttachmentImageDefaultClassName =
  "max-h-56 w-full object-cover";

/** E-Mail: Logos/Signaturen klein halten, Seitenverhältnis erhalten. */
export const contactMessageAttachmentImageEmailClassName =
  "mx-auto h-auto max-h-36 w-auto max-w-[min(100%,12rem)] object-contain";

function formatByteSize(bytes: number | null | undefined): string | null {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
          return (
            <a
              key={a.id}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className={imageLinkClassName}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.url}
                alt={a.fileName}
                className={imageClassName}
                loading="lazy"
                onLoad={() => {
                  window.dispatchEvent(
                    new CustomEvent("gwada:contact-chat-content-layout"),
                  );
                }}
              />
            </a>
          );
        }

        return (
          <a
            key={a.id}
            href={a.url}
            download={a.fileName}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs transition-colors",
              outbound
                ? "border-accent-foreground/25 bg-accent-foreground/10 hover:bg-accent-foreground/15"
                : "border-border/50 bg-background/80 hover:bg-muted/50",
            )}
          >
            <FileText className="size-4 shrink-0 opacity-70" aria-hidden />
            <span className="min-w-0 flex-1 truncate font-medium">
              {a.fileName}
            </span>
            {formatByteSize(a.byteSize ?? null) ? (
              <span className="shrink-0 text-muted-foreground">
                {formatByteSize(a.byteSize ?? null)}
              </span>
            ) : null}
            <Download className="size-3.5 shrink-0 opacity-60" aria-hidden />
          </a>
        );
      })}
    </div>
  );
}
