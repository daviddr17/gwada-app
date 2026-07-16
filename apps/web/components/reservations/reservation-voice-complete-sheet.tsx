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
import { isVoiceConfirmUtterance } from "@/lib/voice/voice-confirm-utterance";
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
  dateExplicit?: boolean;
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
    dateExplicit: params.dateExplicit ?? Boolean(params.dateYmd),
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
  /** Speech beim Öffnen starten (fehlende Felder oder „Ja“-Bestätigung). */
  autoListen?: boolean;
};

export function ReservationVoiceCompleteSheet({
  open,
  onOpenChange,
  initialDraft,
  onConfirm,
  autoListen = true,
}: ReservationVoiceCompleteSheetProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [partySize, setPartySize] = useState<number | null>(null);
  const [dateYmd, setDateYmd] = useState("");
  const [dateExplicit, setDateExplicit] = useState(false);
  const [timeHm, setTimeHm] = useState("");
  const [heardText, setHeardText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [speechHint, setSpeechHint] = useState<string | null>(null);
  const typedDuringListenRef = useRef(false);
  const userStoppedRef = useRef(false);
  const openRef = useRef(open);
  const submittingRef = useRef(false);
  const partyInputRef = useRef<HTMLInputElement>(null);
  const dateWrapRef = useRef<HTMLDivElement>(null);
  const timeInputRef = useRef<HTMLInputElement>(null);
  const fieldsRef = useRef({
    firstName: "",
    lastName: "",
    partySize: null as number | null,
    dateYmd: "",
    dateExplicit: false,
    timeHm: "",
    heardText: "",
  });

  openRef.current = open;
  submittingRef.current = submitting;
  fieldsRef.current = {
    firstName,
    lastName,
    partySize,
    dateYmd,
    dateExplicit,
    timeHm,
    heardText,
  };

  const applyDraft = useCallback((draft: ReservationVoiceDraft) => {
    setFirstName(draft.guestFirstName);
    setLastName(draft.guestLastName);
    setPartySize(draft.partySize);
    setDateYmd(draft.dateYmd ?? "");
    setDateExplicit(draft.dateExplicit);
    setTimeHm(draft.timeHm ?? "");
    setHeardText(draft.rawTranscript);
  }, []);

  useEffect(() => {
    if (!open || !initialDraft) return;
    applyDraft(initialDraft);
    typedDuringListenRef.current = false;
    userStoppedRef.current = false;
    setSpeechHint(null);
  }, [open, initialDraft, applyDraft]);

  const currentDraft = draftFromFields({
    firstName,
    lastName,
    partySize,
    dateYmd,
    dateExplicit,
    timeHm,
    rawTranscript: heardText,
  });
  const missing = currentDraft.missing;
  const isComplete = missing.length === 0;
  const canSubmit = isComplete && !submitting;

  const handleSubmitRef = useRef<() => Promise<void>>(async () => {});

  const { supported, listening, interim, start, stop } = useSpeechRecognition({
    lang: "de-DE",
    silenceFinalizeMs: isComplete ? 1400 : 2400,
    onError: (message) => setSpeechHint(message),
    onFinal: (transcript, alternatives) => {
      if (submittingRef.current || !openRef.current) return;

      const candidates = [transcript, ...(alternatives ?? [])].filter(Boolean);
      const fields = fieldsRef.current;
      const base = draftFromFields({
        firstName: fields.firstName,
        lastName: fields.lastName,
        partySize: fields.partySize,
        dateYmd: fields.dateYmd,
        dateExplicit: fields.dateExplicit,
        timeHm: fields.timeHm,
        rawTranscript: fields.heardText,
      });

      if (base.missing.length === 0) {
        const confirmHit = candidates.some((c) =>
          isVoiceConfirmUtterance(c),
        );
        if (confirmHit) {
          void handleSubmitRef.current();
          return;
        }
      } else if (
        candidates.every(
          (c) => !c.trim() || isVoiceConfirmUtterance(c),
        )
      ) {
        setSpeechHint(
          `Noch offen: ${base.missing.map((m) => MISSING_HINT[m]).join(", ")}`,
        );
        return;
      }

      const incoming = parseReservationVoiceDraftWithAlternatives(
        transcript,
        alternatives ?? [],
      );
      const merged = mergeReservationVoiceDrafts(base, incoming);
      applyDraft(merged);

      if (merged.missing.length > 0) {
        setSpeechHint(
          `Noch offen: ${merged.missing.map((m) => MISSING_HINT[m]).join(", ")}`,
        );
      } else {
        setSpeechHint('Sag „Ja“ oder tippe Anlegen.');
      }

      if (
        !typedDuringListenRef.current &&
        !userStoppedRef.current &&
        openRef.current
      ) {
        window.setTimeout(() => {
          if (
            typedDuringListenRef.current ||
            userStoppedRef.current ||
            submittingRef.current ||
            !openRef.current
          ) {
            return;
          }
          start();
        }, 420);
      }
    },
  });

  const abortSpeechForTyping = useCallback(() => {
    if (!listening) return;
    typedDuringListenRef.current = true;
    userStoppedRef.current = true;
    stop("flush");
  }, [listening, stop]);

  useEffect(() => {
    if (!open || !autoListen || !supported || !initialDraft) return;
    const timer = window.setTimeout(() => {
      if (!typedDuringListenRef.current && !userStoppedRef.current) start();
    }, 280);
    return () => window.clearTimeout(timer);
  }, [autoListen, initialDraft, open, start, supported]);

  useEffect(() => {
    if (!open || listening || !initialDraft || isComplete) return;
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

  const handleSubmit = useCallback(async () => {
    const fields = fieldsRef.current;
    const draft = draftFromFields({
      firstName: fields.firstName,
      lastName: fields.lastName,
      partySize: fields.partySize,
      dateYmd: fields.dateYmd,
      dateExplicit: fields.dateExplicit,
      timeHm: fields.timeHm,
      rawTranscript: fields.heardText,
    });
    const parsed = reservationVoiceDraftToParsed(draft);
    if (!parsed) return;
    stop("discard");
    setSubmitting(true);
    try {
      await onConfirm(parsed);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }, [onConfirm, onOpenChange, stop]);

  handleSubmitRef.current = handleSubmit;

  const toggleListen = () => {
    if (listening) {
      userStoppedRef.current = true;
      stop("flush");
      return;
    }
    typedDuringListenRef.current = false;
    userStoppedRef.current = false;
    setSpeechHint(
      isComplete ? 'Sag „Ja“ oder tippe Anlegen.' : null,
    );
    start();
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
          <DrawerTitle className="text-xl">
            {isComplete ? "Reservierung anlegen?" : "Reservierung ergänzen"}
          </DrawerTitle>
          <p className="text-sm text-muted-foreground">
            {missing.length > 0
              ? `Noch nötig: ${missing.map((m) => MISSING_HINT[m]).join(", ")}. Ohne Datum gilt heute. Tippen bricht die Sprache ab.`
              : "Werte prüfen oder kurz ändern. Ohne genanntes Datum gilt heute. Sag „Ja“ / „Anlegen“ oder tippe Anlegen."}
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
                onOpenChange={(pickerOpen) => {
                  if (pickerOpen) abortSpeechForTyping();
                }}
                onChange={(v) => {
                  abortSpeechForTyping();
                  setDateYmd(v ?? "");
                  setDateExplicit(Boolean(v));
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
                  {isComplete ? "„Ja“ hören" : "Nochmal sprechen"}
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
