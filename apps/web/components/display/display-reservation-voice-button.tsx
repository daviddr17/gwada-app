"use client";

import { Mic, Square } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { ReservationVoiceCompleteSheet } from "@/components/reservations/reservation-voice-complete-sheet";
import { Button } from "@/components/ui/button";
import { createDisplayReservationFromVoiceParsed } from "@/lib/display/display-reservation-voice-create-client";
import type { DisplayReservationRow } from "@/lib/display/display-reservations-server";
import { useSpeechRecognition } from "@/lib/hooks/use-speech-recognition";
import type { BookingTimeStepMinutes } from "@/lib/reservations/booking-time-step";
import {
  parseReservationVoiceDraftWithAlternatives,
  type ParsedReservationVoice,
  type ReservationVoiceDraft,
} from "@/lib/reservations/parse-reservation-voice-text";
import type { ReservationStatusJoin } from "@/lib/supabase/reservations-db";
import { brandActionButtonClassName } from "@/lib/ui/brand-action-button";
import { SpeechLiveCaption } from "@/lib/ui/speech-live-caption";
import { cn } from "@/lib/utils";

type DisplayReservationVoiceButtonProps = {
  disabled?: boolean;
  defaultDwellMinutes: number;
  bookingTimeStepMinutes: BookingTimeStepMinutes;
  timeZone: string;
  statuses: ReservationStatusJoin[];
  onCreated: (row: DisplayReservationRow | null) => void;
};

export function DisplayReservationVoiceButton({
  disabled = false,
  defaultDwellMinutes,
  bookingTimeStepMinutes,
  timeZone,
  statuses,
  onCreated,
}: DisplayReservationVoiceButtonProps) {
  const [mounted, setMounted] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState<ReservationVoiceDraft | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const createFromParsed = useCallback(
    async (parsed: ParsedReservationVoice) => {
      const result = await createDisplayReservationFromVoiceParsed({
        parsed,
        defaultDwellMinutes,
        bookingTimeStepMinutes,
        timeZone,
        statuses,
      });
      if (!result.ok) {
        toast.error(result.error);
        throw new Error(result.error);
      }
      toast.success(
        result.reservationNumber
          ? `Reservierung #${result.reservationNumber} angelegt.`
          : "Reservierung angelegt.",
      );
      onCreated(result.reservation);
      setDraft(null);
    },
    [
      bookingTimeStepMinutes,
      defaultDwellMinutes,
      onCreated,
      statuses,
      timeZone,
    ],
  );

  const handleFinalTranscript = useCallback(
    (transcript: string, alternatives?: string[]) => {
      const next = parseReservationVoiceDraftWithAlternatives(
        transcript,
        alternatives ?? [],
      );
      if (!next.rawTranscript) {
        toast.error("Kein Text erkannt.", {
          description: "Beispiel: Max Mustermann, 3 Personen, 18.7., 19 Uhr",
        });
        return;
      }
      setDraft(next);
      setSheetOpen(true);
    },
    [],
  );

  const handleSpeechError = useCallback((message: string) => {
    toast.error(message);
  }, []);

  const { supported, listening, interim, start, stop } = useSpeechRecognition({
    lang: "de-DE",
    onFinal: handleFinalTranscript,
    onError: handleSpeechError,
    silenceFinalizeMs: 2400,
  });

  const toggleListening = () => {
    if (listening) stop("flush");
    else start();
  };

  if (!mounted || !supported || statuses.length === 0) return null;

  return (
    <>
      {mounted
        ? createPortal(
            <SpeechLiveCaption
              listening={listening}
              interim={interim}
              floating
            />,
            document.body,
          )
        : null}

      <ReservationVoiceCompleteSheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) setDraft(null);
        }}
        initialDraft={draft}
        onConfirm={createFromParsed}
      />

      <Button
        type="button"
        size="lg"
        className={cn(
          "h-12 w-12 shrink-0 rounded-full px-0",
          brandActionButtonClassName,
          listening && "animate-pulse ring-4 ring-accent/30",
        )}
        aria-label={
          listening
            ? "Aufnahme beenden"
            : "Reservierung per Sprache anlegen"
        }
        aria-pressed={listening}
        disabled={disabled}
        onClick={toggleListening}
      >
        {listening ? (
          <Square className="size-5 fill-current" aria-hidden />
        ) : (
          <Mic className="size-5" strokeWidth={2.25} aria-hidden />
        )}
      </Button>
    </>
  );
}
