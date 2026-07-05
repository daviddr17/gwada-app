"use client";

import { useEffect, useState } from "react";
import { EmbedGwadaFooter } from "@/components/embed/embed-gwada-footer";
import type { EmbedTextTheme } from "@/lib/embed/embed-appearance";
import { isExternalHostEmbed } from "@/lib/embed/is-external-host-embed";
import { applyAccentToDocument } from "@/lib/theme/color-utils";
import { cn } from "@/lib/utils";

export function EmbedAccentRoot({
  accentHex,
  textTheme = "dark",
  children,
  brandFooter = true,
}: {
  accentHex: string;
  /** Helle Schrift auf dunklem Host vs. dunkle Schrift auf hellem Host. */
  textTheme?: EmbedTextTheme;
  children: React.ReactNode;
  /** Gwada-Logo unter dem Widget (nicht bei gwada.js auf fremden Sites). */
  brandFooter?: boolean;
}) {
  const [externalHostEmbed, setExternalHostEmbed] = useState(false);

  useEffect(() => {
    applyAccentToDocument(accentHex);
    setExternalHostEmbed(isExternalHostEmbed());
  }, [accentHex]);

  const showBrandFooter = brandFooter && !externalHostEmbed;

  return (
    <div
      className={cn(
        "min-h-0 w-full min-w-0 bg-transparent text-foreground antialiased",
        textTheme === "light" && "dark",
      )}
    >
      <div className="flex w-full min-w-0 flex-col">
        {children}
        {showBrandFooter ? <EmbedGwadaFooter /> : null}
      </div>
    </div>
  );
}
