"use client";

import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import {
  drawerFormHeaderClassName,
  drawerFormSectionTitleClassName,
  drawerScrollAreaClassName,
} from "@/lib/ui/drawer-form-section";
import { settingsAccentSaveButtonClassName } from "@/components/settings/settings-sticky-save-bar";
import { parseWahaReleaseNotes } from "@/lib/waha/waha-version";
import type { WahaServerVersionStatus } from "@/lib/superadmin/waha-servers-api";
import { cn } from "@/lib/utils";

function formatPublishedAt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

type SuperadminWahaVersionDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverName: string;
  version: WahaServerVersionStatus | null;
  canStartUpdate: boolean;
  updateBusy?: boolean;
  onStartUpdate: () => void;
};

export function SuperadminWahaVersionDrawer({
  open,
  onOpenChange,
  serverName,
  version,
  canStartUpdate,
  updateBusy = false,
  onStartUpdate,
}: SuperadminWahaVersionDrawerProps) {
  const sections = parseWahaReleaseNotes(version?.latestReleaseBody ?? null);
  const updateAvailable = Boolean(version?.updateAvailable);
  const latest = version?.latestVersion ?? "—";
  const current = version?.currentVersion ?? "—";

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent className={drawerContentClassName("wide")}>
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            {updateAvailable ? "WAHA-Update verfügbar" : "WAHA-Version"}
          </DrawerTitle>
          <DrawerDescription className="text-sm leading-relaxed">
            {serverName}:{" "}
            <span className="font-mono text-foreground">{current}</span>
            {updateAvailable ? (
              <>
                {" → "}
                <span className="font-mono text-foreground">{latest}</span>
              </>
            ) : null}
            {version?.latestPublishedAt ? (
              <span className="block text-muted-foreground">
                Release vom {formatPublishedAt(version.latestPublishedAt)}
              </span>
            ) : null}
          </DrawerDescription>
        </DrawerHeader>

        <div className={drawerScrollAreaClassName(6)}>
          <div className="space-y-5 pb-2">
            {version?.engine || version?.nodeVersion ? (
              <dl className="grid grid-cols-2 gap-3 rounded-xl border border-border/50 bg-muted/15 px-3 py-3 text-sm">
                {version.engine ? (
                  <div>
                    <dt className="text-xs text-muted-foreground">Engine</dt>
                    <dd className="font-mono text-xs">{version.engine}</dd>
                  </div>
                ) : null}
                {version.nodeVersion ? (
                  <div>
                    <dt className="text-xs text-muted-foreground">Node</dt>
                    <dd className="font-mono text-xs">{version.nodeVersion}</dd>
                  </div>
                ) : null}
              </dl>
            ) : null}

            {sections.length > 0 ? (
              sections.map((section) => (
                <section key={section.title} className="space-y-2">
                  <h3 className={drawerFormSectionTitleClassName}>
                    {section.title}
                  </h3>
                  <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
                    {section.items.map((item, i) => (
                      <li key={`${section.title}-${i}`}>{item}</li>
                    ))}
                  </ul>
                </section>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                Keine Release-Notes verfügbar
                {version?.latestVersion
                  ? ` für ${version.latestVersion}`
                  : ""}
                . Die Versionsnummer kommt von GitHub; der Text fehlte oder war
                leer.
              </p>
            )}

            {version?.latestHtmlUrl ? (
              <a
                href={version.latestHtmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 hover:underline"
              >
                Auf GitHub ansehen
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            ) : null}
          </div>
        </div>

        <DrawerFooter className="gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className={cn(brandActionButtonRoundedClassName, "sm:flex-1")}
            onClick={() => onOpenChange(false)}
          >
            Schließen
          </Button>
          {updateAvailable ? (
            <Button
              type="button"
              className={cn(settingsAccentSaveButtonClassName, "sm:flex-1")}
              disabled={!canStartUpdate || updateBusy}
              title={
                canStartUpdate
                  ? `Auf ${latest} updaten`
                  : "SSH und Docker-Container unter Bearbeiten setzen"
              }
              onClick={onStartUpdate}
            >
              {updateBusy ? "Startet …" : "Weiter zum Update"}
            </Button>
          ) : null}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
