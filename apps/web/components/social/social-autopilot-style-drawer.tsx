"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { APP_ROUTES } from "@/lib/navigation/app-routes";
import {
  SOCIAL_TONE_LABELS,
  type SocialBrandKit,
} from "@/lib/social/social-brand-kit";
import type { SocialAutopilotVoiceDraft } from "@/lib/social/social-autopilot-voice-draft";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerScrollAreaClassName } from "@/lib/ui/drawer-form-section";
import {
  autopilotGhostButtonClassName,
  autopilotPrimaryButtonClassName,
  autopilotSecondaryButtonClassName,
} from "@/lib/ui/social-autopilot-buttons";

export type { SocialAutopilotVoiceDraft } from "@/lib/social/social-autopilot-voice-draft";

/**
 * Selbsterklärendes Bottom Sheet: Schreibstil + optional aus Social lernen.
 * Keine Chip-Wand — zwei klare Schritte.
 */
export function SocialAutopilotStyleDrawer({
  open,
  onOpenChange,
  kit,
  voiceBusy,
  voiceDraft,
  onLearnFromSocial,
  onConfirmVoice,
  onDiscardVoice,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kit: SocialBrandKit | null;
  voiceBusy: boolean;
  voiceDraft: SocialAutopilotVoiceDraft | null;
  onLearnFromSocial: () => void | Promise<void>;
  onConfirmVoice: () => void | Promise<void>;
  onDiscardVoice: () => void;
}) {
  const toneLabel = kit
    ? SOCIAL_TONE_LABELS[kit.tone]
    : SOCIAL_TONE_LABELS.warm;
  const voicePreview =
    kit?.voiceNotes?.trim() ||
    "Noch kein eigener Text — Autopilot nutzt den Ton oben.";

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent className={drawerContentClassName("form")}>
        <DrawerHeader className="text-left">
          <DrawerTitle>Schreibstil</DrawerTitle>
          <DrawerDescription>
            So klingen eure Autopilot-Posts. Einmal einstellen — fertig.
          </DrawerDescription>
        </DrawerHeader>

        <div className={drawerScrollAreaClassName(6)}>
          <div className="space-y-6 pb-4">
            <section className="space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  1. Euer Ton
                </p>
                <p className="text-sm text-muted-foreground">
                  Warm, locker, fein oder modern — wie ihr mit Gästen sprecht.
                </p>
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-3 space-y-2">
                <p className="text-sm font-medium text-foreground">
                  {toneLabel}
                </p>
                <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                  {voicePreview}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className={autopilotSecondaryButtonClassName}
                render={<Link href={APP_ROUTES.settings.restaurant} />}
              >
                Ton und Texte anpassen
              </Button>
            </section>

            <section className="space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  2. Optional: aus Social lernen
                </p>
                <p className="text-sm text-muted-foreground">
                  Wir lesen eure letzten Instagram- und Facebook-Texte und
                  schlagen Stimme vor. Nichts wird gespeichert, bis ihr
                  „Übernehmen“ tippt.
                </p>
              </div>

              {voiceDraft ? (
                <div className="space-y-3 rounded-xl border border-border/50 bg-muted/20 px-3 py-3">
                  <p className="text-xs font-medium text-foreground">
                    Vorschlag aus {voiceDraft.sampleCount} Posts
                    {voiceDraft.fromLlm ? "" : " (ohne KI)"}
                  </p>
                  {voiceDraft.tone ? (
                    <p className="text-xs text-muted-foreground">
                      Ton: {SOCIAL_TONE_LABELS[voiceDraft.tone]}
                    </p>
                  ) : null}
                  <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                    {voiceDraft.voiceNotes}
                  </p>
                  {voiceDraft.goldCaptions.length > 0 ? (
                    <ul className="space-y-1.5">
                      {voiceDraft.goldCaptions.slice(0, 3).map((c) => (
                        <li
                          key={c}
                          className="rounded-lg bg-background/60 px-2 py-1.5 text-[11px] text-muted-foreground"
                        >
                          „{c}“
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="flex flex-col gap-2">
                    <Button
                      type="button"
                      className={autopilotPrimaryButtonClassName}
                      disabled={voiceBusy}
                      onClick={() => void onConfirmVoice()}
                    >
                      Übernehmen
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className={autopilotGhostButtonClassName}
                      disabled={voiceBusy}
                      onClick={onDiscardVoice}
                    >
                      Verwerfen
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  className={autopilotPrimaryButtonClassName}
                  disabled={voiceBusy || !kit}
                  onClick={() => void onLearnFromSocial()}
                >
                  {voiceBusy ? "Lese eure Posts …" : "Aus Social lernen"}
                </Button>
              )}
            </section>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
