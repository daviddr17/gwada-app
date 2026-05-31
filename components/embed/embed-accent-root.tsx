"use client";

import { useEffect } from "react";
import { applyAccentToDocument } from "@/lib/theme/color-utils";

export function EmbedAccentRoot({
  accentHex,
  children,
}: {
  accentHex: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    applyAccentToDocument(accentHex);
  }, [accentHex]);

  return (
    <div className="min-h-0 w-full min-w-0 bg-background text-foreground antialiased">
      {children}
    </div>
  );
}
