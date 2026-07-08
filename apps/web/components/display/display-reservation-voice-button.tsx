"use client";

import { Mic, Square } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { createDisplayReservationFromVoiceParsed } from "@/lib/display/display-reservation-voice-create-client";
import type { DisplayReservationRow } from "@/lib/display/display-reservations-server";
import { useSpeechRecognition } from "@/lib/hooks/use-speech-recognition";
import type { BookingTimeStepMinutes } from "@/lib/reservations/booking-time-step";
import {
  formatParsedReservationVoiceLabel,
  parseReservationVoiceText,
  type ParsedReservationVoice,
} from "@/lib/reservations/parse-reservation-voice-text";
import type { ReservationStatusJoin } from "@/lib/supabase/reservations-db";
import { brandActionButtonClassName } from "@/lib/ui/brand-action-button";
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState<ParsedReservationVoice | null>(null);
  const [heardText, setHeardText] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleFinalTranscript = useCallback((transcript: string) => {
    setHeardText(transcript);
    const result = parseReservationVoiceText(transcript);
    if (!result.ok) {
      toast.error(result.error, {
        description: "Beispiel: Max Mustermann, 3 Personen, 18.7., 19 Uhr",
      });
      return;
    }
    setPending(result.parsed);
    setConfirmOpen(true);
  }, []);

  const handleSpeechError = useCallback((message: string) => {
    toast.error(message);
  }, []);

  const { supported, listening, start, stop } = useSpeechRecognition({
    lang: "de-DE",
    onFinal: handleFinalTranscript,
    onError: handleSpeechError,
  });

  const toggleListening = () => {
    if (listening) stop();
    else start();
  };

  const handleConfirm = async () => {
    if (!pending) return;
    const result = await createDisplayReservationFromVoiceParsed({
      parsed: pending,
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
    setPending(null);
    setHeardText("");
  };

  if (!mounted || !supported || statuses.length === 0) return null;

  const preview = pending ? formatParsedReservationVoiceLabel(pending) : null;

  return (
    <>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) setPending(null);
        }}
        title="Reservierung anlegen?"
        description={
          <div className="space-y-2 text-sm text-muted-foreground">
            {preview ? (
              <p className="font-medium text-foreground">{preview}</p>
            ) : null}
            {heardText ? (
              <p className="text-xs italic">„{heardText}"</p>
            ) : null}
            <p>Ein Tippen legt die Reservierung an — ohne weiteres Formular.</p>
          </div>
        }
        confirmLabel="Anlegen"
        cancelLabel="Abbrechen"
        destructive={false}
        onConfirm={handleConfirm}
      />

      <Button
        type="button"
        size="lg"
        className={cn(
          "h-12 w-12 shrink-0 rounded-xl px-0",
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
