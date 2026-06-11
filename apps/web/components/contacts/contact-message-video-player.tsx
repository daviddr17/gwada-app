"use client";

import { cn } from "@/lib/utils";

export function ContactMessageVideoPlayer({
  url,
  fileName,
  className,
}: {
  url: string;
  fileName: string;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-lg border border-border/40", className)}>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        src={url}
        controls
        playsInline
        preload="metadata"
        className="max-h-56 w-full bg-black object-contain"
        aria-label={fileName}
        onLoadedMetadata={() => {
          window.dispatchEvent(
            new CustomEvent("gwada:contact-chat-content-layout"),
          );
        }}
      />
    </div>
  );
}
