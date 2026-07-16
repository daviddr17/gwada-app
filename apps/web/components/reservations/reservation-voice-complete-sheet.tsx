"use client";

import { Mic, Minus, Plus, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/ui/date-picker";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSpeechRecognition } from "@/lib/hooks/use-speech-recognition";
import {
  mergeReservationVoiceDrafts,
  parseReservationVoiceDraftWithAlternatives,
  reservationVoiceDraftToParsed,
  type ParsedReservationVoice,
  type ReservationVoiceDraft,
  type ReservationVoiceMissingField,
} from "@/lib/reservations/parse-reservation-voice-text";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { SpeechLiveCaption } from "@/lib/ui/speech-live-caption";
import { cn } from "@/lib/utils";

const MISSING_HINT: Record<ReservationVoiceMissingField, string> = {
  partySize: "Personenanzahl",
  dateYmd: "Datum",
  timeHm: "Uhrzeit",
};

function draftFromFields(params: {
  firstName: string;
  lastName: string;
  partySize: number | null;
  dateYmd: string;
  timeHm: string;
  rawTranscript: string;
}): ReservationVoiceDraft {
  const missing: ReservationVoiceMissingField[] = [];
  if (params.partySize == null || params.partySize < 1) missing.push("partySize");
  if (!params.dateYmd) missing.push("dateYmd");
  if (!params.timeHm) missing.push("timeHm");
  return {
    guestFirstName: params.firstName.trim(),
    guestLastName: params.lastName.trim(),
    partySize: params.partySize,
    dateYmd: params.dateYmd || null,
    timeHm: params.timeHm || null,
    rawName: [params.firstName, params.lastName].filter(Boolean).join(" "),
    rawTranscript: params.rawTranscript,
    missing,
  };
}

type ReservationVoiceCompleteSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDraft: ReservationVoiceDraft | null;
  onConfirm: (parsed: ParsedReservationVoice) => Promise<void>;
  /** Optional: Speech direkt starten wenn Sheet öffnet und Felder fehlen. */
  autoListenMissing?: boolean;
};

export function ReservationVoiceCompleteSheet({
  open,
  onOpenChange,
  initialDraft,
  onConfirm,
  autoListenMissing = true,
}: ReservationVoiceCompleteSheetProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [partySize, setPartySize] = useState<number | null>(null);
  const [dateYmd, setDateYmd] = useState("");
  const [timeHm, setTimeHm] = useState("");
  const [heardText, setHeardText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [speechHint, setSpeechHint] = useState<string | null>(null);
  const typedDuringListenRef = useRef(false);
  const partyInputRef = useRef<HTMLInputElement>(null);
  const dateWrapRef = useRef<HTMLDivElement>(null);
  const timeInputRef = useRef<HTMLInputElement>(null);

  const applyDraft = useCallback((draft: ReservationVoiceDraft) => {
    setFirstName(draft.guestFirstName);
    setLastName(draft.guestLastName);
    setPartySize(draft.partySize);
    setDateYmd(draft.dateYmd ?? "");
    setTimeHm(draft.timeHm ?? "");
    setHeardText(draft.rawTranscript);
  }, []);

  useEffect(() => {
    if (!open || !initialDraft) return;
    applyDraft(initialDraft);
    typedDuringListenRef.current = false;
    setSpeechHint(null);
  }, [open, initialDraft, applyDraft]);

  const currentDraft = draftFromFields({
    firstName,
    lastName,
    partySize,
    dateYmd,
    timeHm,
    rawTranscript: heardText,
  });
  const missing = currentDraft.missing;
  const canSubmit = missing.length === 0 && !submitting;

  const handleFinalTranscript = useCallback(
    (transcript: string, alternatives?: string[]) => {
      const incoming = parseReservationVoiceDraftWithAlternatives(
        transcript,
        alternatives ?? [],
      );
      const base = draftFromFields({
        firstName,
        lastName,
        partySize,
        dateYmd,
        timeHm,
        rawTranscript: heardText,
      });
      // Tippen hat Vorrang: bereits gesetzte Felder nicht mit leerem Speech überschreiben.
      const merged = mergeReservationVoiceDrafts(base, incoming);
      applyDraft(merged);
      setSpeechHint(
        merged.missing.length > 0
          ? `Noch offen: ${merged.missing.map((m) => MISSING_HINT[m]).join(", ")}`
          : null,
      );
    },
    [applyDraft, dateYmd, firstName, heardText, lastName, partySize, timeHm],
  );

  const { supported, listening, interim, start, stop } = useSpeechRecognition({
    lang: "de-DE",
    onFinal: handleFinalTranscript,
    onError: (message) => setSpeechHint(message),
    silenceFinalizeMs: 2400,
  });

  const abortSpeechForTyping = useCallback(() => {
    if (!listening) return;
    typedDuringListenRef.current = true;
    stop("flush");
  }, [listening, stop]);

  useEffect(() => {
    if (!open || !autoListenMissing || !supported || !initialDraft) return;
    if (initialDraft.missing.length === 0) return;
    const timer = window.setTimeout(() => {
      if (!typedDuringListenRef.current) start();
    }, 280);
    return () => window.clearTimeout(timer);
  }, [autoListenMissing, initialDraft, open, start, supported]);

  useEffect(() => {
    if (!open || listening || !initialDraft) return;
    const firstMissing = currentDraft.missing[0];
    if (!firstMissing) return;
    const timer = window.setTimeout(() => {
      if (firstMissing === "partySize") partyInputRef.current?.focus();
      else if (firstMissing === "timeHm") timeInputRef.current?.focus();
      else if (firstMissing === "dateYmd") {
        dateWrapRef.current?.querySelector("button")?.focus();
      }
    }, 120);
    return () => window.clearTimeout(timer);
    // Nur beim Öffnen / nach Speech fokussieren — nicht bei jedem Keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [open, listening]);

  const handleSubmit = async () => {
    const parsed = reservationVoiceDraftToParsed(currentDraft);
    if (!parsed) return;
    setSubmitting(true);
    try {
      await onConfirm(parsed);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleListen = () => {
    if (listening) stop("flush");
    else {
      typedDuringListenRef.current = false;
      setSpeechHint(null);
      start();
    }
  };

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) stop("discard");
        onOpenChange(next);
      }}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent className="mx-auto max-h-[92vh] max-w-lg">
        <DrawerHeader className="pb-2 text-left">
          <DrawerTitle className="text-xl">Reservierung ergänzen</DrawerTitle>
          <p className="text-sm text-muted-foreground">
            {missing.length > 0
              ? `Noch nötig: ${missing.map((m) => MISSING_HINT[m]).join(", ")}. Tippen bricht die Sprache ab.`
              : "Alles da — du kannst anlegen."}
          </p>
          {heardText ? (
            <p className="mt-1 text-xs italic text-muted-foreground">
              „{heardText}“
            </p>
          ) : null}
        </DrawerHeader>

        <div className="space-y-4 overflow-y-auto px-4 pb-2">
          {listening ? (
            <SpeechLiveCaption listening={listening} interim={interim} />
          ) : null}
          {speechHint ? (
            <p className="rounded-xl bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              {speechHint}
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="voice-res-first">Vorname</Label>
              <Input
                id="voice-res-first"
                value={firstName}
                className="h-12 rounded-xl text-base"
                autoComplete="given-name"
                onFocus={abortSpeechForTyping}
                onChange={(e) => {
                  abortSpeechForTyping();
                  setFirstName(e.target.value);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="voice-res-last">Nachname</Label>
              <Input
                id="voice-res-last"
                value={lastName}
                className="h-12 rounded-xl text-base"
                autoComplete="family-name"
                onFocus={abortSpeechForTyping}
                onChange={(e) => {
                  abortSpeechForTyping();
                  setLastName(e.target.value);
                }}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="voice-res-party">Personen</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="size-12 shrink-0 rounded-xl"
                aria-label="Weniger Personen"
                onClick={() => {
                  abortSpeechForTyping();
                  setPartySize((n) => Math.max(1, (n ?? 2) - 1));
                }}
              >
                <Minus className="size-5" aria-hidden />
              </Button>
              <Input
                ref={partyInputRef}
                id="voice-res-party"
                inputMode="numeric"
                type="number"
                min={1}
                max={50}
                value={partySize ?? ""}
                placeholder="z. B. 3"
                className={cn(
                  "h-12 rounded-xl text-center text-lg tabular-nums",
                  missing.includes("partySize") && "border-amber-500/60",
                )}
                onFocus={abortSpeechForTyping}
                onChange={(e) => {
                  abortSpeechForTyping();
                  const n = Number.parseInt(e.target.value, 10);
                  setPartySize(
                    Number.isFinite(n) && n >= 1 ? Math.min(50, n) : null,
                  );
                }}
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="size-12 shrink-0 rounded-xl"
                aria-label="Mehr Personen"
                onClick={() => {
                  abortSpeechForTyping();
                  setPartySize((n) => Math.min(50, (n ?? 0) + 1 || 1));
                }}
              >
                <Plus className="size-5" aria-hidden />
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div ref={dateWrapRef} className="space-y-1.5">
              <Label htmlFor="voice-res-date">Datum</Label>
              <DatePickerField
                id="voice-res-date"
                value={dateYmd || null}
                onOpenChange={(open) => {
                  if (open) abortSpeechForTyping();
                }}
                onChange={(v) => {
                  abortSpeechForTyping();
                  setDateYmd(v ?? "");
                }}
                fullWidth
                className={cn(
                  "h-12 rounded-xl text-base",
                  missing.includes("dateYmd") && "border-amber-500/60",
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="voice-res-time">Uhrzeit</Label>
              <Input
                ref={timeInputRef}
                id="voice-res-time"
                type="time"
                value={timeHm}
                className={cn(
                  "h-12 rounded-xl text-base",
                  missing.includes("timeHm") && "border-amber-500/60",
                )}
                onFocus={abortSpeechForTyping}
                onChange={(e) => {
                  abortSpeechForTyping();
                  setTimeHm(e.target.value);
                }}
              />
            </div>
          </div>
        </div>

        <DrawerFooter className="gap-2 sm:flex-row sm:items-center">
          {supported ? (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-12 rounded-xl sm:w-auto"
              onClick={toggleListen}
            >
              {listening ? (
                <>
                  <Square className="size-4 fill-current" aria-hidden />
                  Stop
                </>
              ) : (
                <>
                  <Mic className="size-4" aria-hidden />
                  Nochmal sprechen
                </>
              )}
            </Button>
          ) : null}
          <Button
            type="button"
            size="lg"
            className={cn(
              brandActionButtonRoundedClassName,
              "h-12 flex-1 text-base",
            )}
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
          >
            {submitting ? "Legt an…" : "Anlegen"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
