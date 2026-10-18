"use client";

import { DatePickerField } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { OpeningHoursClosureMode } from "@/lib/opening-hours/closure";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";

export function OpeningHoursClosureCard({
  mode,
  from,
  until,
  onModeChange,
  onFromChange,
  onUntilChange,
}: {
  mode: OpeningHoursClosureMode;
  from: string | null;
  until: string | null;
  onModeChange: (mode: OpeningHoursClosureMode) => void;
  onFromChange: (ymd: string | null) => void;
  onUntilChange: (ymd: string | null) => void;
}) {
  return (
    <div className="space-y-4 rounded-xl border border-border/40 bg-muted/20 px-3 py-3 sm:px-4">
      <div className="space-y-1.5">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">
          Schließungsstatus
        </h3>
        <p className="text-xs text-muted-foreground">
          Overlay über dem Wochenplan — die gespeicherten Wochentage bleiben
          erhalten (z.&nbsp;B. Winterpause). Sync an Google und Facebook nutzt
          diesen Status.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="opening-hours-closure-mode">Status</Label>
        <Select
          value={mode}
          onValueChange={(v) => {
            if (typeof v !== "string") return;
            if (v === "open" || v === "temporary" || v === "permanent") {
              onModeChange(v);
            }
          }}
        >
          <SelectTrigger
            id="opening-hours-closure-mode"
            className={appSelectTriggerAccentCn("h-11 w-full rounded-xl")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Geöffnet (Wochenplan gilt)</SelectItem>
            <SelectItem value="temporary">
              Vorübergehend geschlossen
            </SelectItem>
            <SelectItem value="permanent">Dauerhaft geschlossen</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {mode === "temporary" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="opening-hours-closure-from">Von (optional)</Label>
            <DatePickerField
              id="opening-hours-closure-from"
              value={from}
              onChange={onFromChange}
              placeholder="Beginn"
              fullWidth
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="opening-hours-closure-until">Bis (optional)</Label>
            <DatePickerField
              id="opening-hours-closure-until"
              value={until}
              onChange={onUntilChange}
              placeholder="Ende"
              fullWidth
              minYmd={from}
            />
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Zeitraum inklusive, Kalender Europe/Berlin. Ohne Daten gilt die
            vorübergehende Schließung sofort bis zum Umschalten.
          </p>
        </div>
      ) : null}

      {mode === "permanent" ? (
        <p className="text-xs text-muted-foreground">
          Google und Facebook werden als dauerhaft geschlossen markiert. Der
          Wochenplan in Gwada bleibt für ein späteres Wiederöffnen erhalten.
        </p>
      ) : null}
    </div>
  );
}
