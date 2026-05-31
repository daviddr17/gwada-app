"use client";

import { DisplayBrandMark } from "@/components/display/display-brand-mark";
import { Button } from "@/components/ui/button";

/** Fußzeile eingeloggter Display-Ansichten: Logo mittig, Abmelden rechts. */
export function DisplayLoggedInFooter({ onLogout }: { onLogout: () => void }) {
  return (
    <footer className="relative shrink-0 border-t border-border/30 py-3">
      <div className="flex justify-center px-4">
        <DisplayBrandMark />
      </div>
      <div className="absolute top-1/2 right-4 -translate-y-1/2 sm:right-6">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 rounded-xl px-3"
          onClick={onLogout}
        >
          Abmelden
        </Button>
      </div>
    </footer>
  );
}
