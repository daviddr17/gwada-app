/** Gästeprofil (QR/Link) + Website-Embed — gemeinsame Einstellungen. */
export const publicSurfaceProfileAndEmbedTitle = "Profil & Einbindung";

export const publicSurfaceProfileAndEmbedDescription =
  "Diese Einstellungen gelten für das Modul im Gästeprofil (QR/Link) und für das eingebettete Widget auf eurer Website.";

export const publicSurfaceEmbedOnlyDescription =
  "Gilt nur für die Website-Einbindung, nicht für das Gästeprofil.";

export function publicSurfaceScopeHint(scope: "both" | "embed"): string {
  return scope === "both"
    ? "Gilt für Gästeprofil und Website-Einbindung."
    : "Gilt nur für die Website-Einbindung.";
}
