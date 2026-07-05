"use client";

import { useCallback, useEffect, useState } from "react";
import { Share, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { displayChromeModeToggleClassName } from "@/lib/ui/display-chrome";
import { cn } from "@/lib/utils";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandaloneDisplayPwa(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua);
  const webkit = /WebKit/.test(ua);
  const notOther = !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return ios && webkit && notOther;
}

/** „Zum Home-Bildschirm“ — Chrome/Edge (Prompt) und iOS (Hinweis). */
export function DisplayPwaInstallButton({ className }: { className?: string }) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [iosHintOpen, setIosHintOpen] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setInstalled(isStandaloneDisplayPwa());
  }, []);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setInstallPrompt(null);
      setInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setInstalled(true);
      }
      setInstallPrompt(null);
      return;
    }

    if (isIosSafari()) {
      setIosHintOpen(true);
    }
  }, [installPrompt]);

  const showButton = !installed && (Boolean(installPrompt) || isIosSafari());
  if (!showButton) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className={cn(displayChromeModeToggleClassName, className)}
        aria-label="Display zum Home-Bildschirm hinzufügen"
        title="Zum Home-Bildschirm hinzufügen"
        onClick={() => void handleInstall()}
      >
        <Smartphone className="size-4" />
      </Button>

      <Drawer open={iosHintOpen} onOpenChange={setIosHintOpen} direction="bottom">
        <DrawerContent className={drawerContentClassName("filter")}>
          <DrawerHeader>
            <DrawerTitle>Zum Home-Bildschirm hinzufügen</DrawerTitle>
            <DrawerDescription>
              So startest du Display wie eine App auf dem iPad oder iPhone.
            </DrawerDescription>
          </DrawerHeader>
          <ol className="space-y-3 px-4 pb-6 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <Share className="mt-0.5 size-4 shrink-0 text-foreground" aria-hidden />
              <span>
                Tippe unten in Safari auf <strong className="text-foreground">Teilen</strong>.
              </span>
            </li>
            <li>
              Wähle <strong className="text-foreground">Zum Home-Bildschirm</strong> und
              bestätige mit <strong className="text-foreground">Hinzufügen</strong>.
            </li>
          </ol>
        </DrawerContent>
      </Drawer>
    </>
  );
}
