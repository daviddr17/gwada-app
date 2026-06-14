"use client";

import { useEffect, useState } from "react";
import { EmbedGwadaFooter } from "@/components/embed/embed-gwada-footer";
import { isExternalHostEmbed } from "@/lib/embed/is-external-host-embed";
import { applyAccentToDocument } from "@/lib/theme/color-utils";

export function EmbedAccentRoot({
  accentHex,
  children,
  brandFooter = true,
}: {
  accentHex: string;
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
    <div className="min-h-0 w-full min-w-0 bg-background text-foreground antialiased">
      <div id="gwada-embed-root" className="flex w-full min-w-0 flex-col">
        {children}
        {showBrandFooter ? <EmbedGwadaFooter /> : null}
      </div>
    </div>
  );
}
