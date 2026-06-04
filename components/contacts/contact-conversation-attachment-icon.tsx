"use client";

import { FileText, ImageIcon } from "lucide-react";
import type { ContactMessageAttachmentKind } from "@/lib/types/contact-message-attachment";
import { cn } from "@/lib/utils";

export function ContactConversationAttachmentIcon({
  kind,
  className,
}: {
  kind: ContactMessageAttachmentKind;
  className?: string;
}) {
  if (kind === "image") {
    return (
      <ImageIcon
        className={cn("size-3.5 shrink-0 opacity-80", className)}
        aria-hidden
      />
    );
  }
  return (
    <FileText
      className={cn("size-3.5 shrink-0 opacity-80", className)}
      aria-hidden
    />
  );
}
