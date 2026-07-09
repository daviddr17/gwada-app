"use client";

import { Mic, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useIsSuperadmin } from "@/lib/hooks/use-is-superadmin";
import { useSpeechRecognition } from "@/lib/hooks/use-speech-recognition";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import {
  formatParsedReservationVoiceLabel,
  parseReservationVoiceTextWithAlternatives,
  type ParsedReservationVoice,
} from "@/lib/reservations/parse-reservation-voice-text";
import { createReservationFromVoiceParsed } from "@/lib/reservations/reservation-voice-create-client";
import { fetchReservationSettings } from "@/lib/supabase/reservation-settings-db";
import { brandActionButtonClassName } from "@/lib/ui/brand-action-button";
import { SpeechLiveCaption } from "@/lib/ui/speech-live-caption";
import { cn } from "@/lib/utils";

export function ReservationVoiceFab() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const { isSuperadmin } = useIsSuperadmin();
  const [mounted, setMounted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState<ParsedReservationVoice | null>(null);
  const [heardText, setHeardText] = useState("");
  const defaultDwellRef = useRef(120);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!restaurantId) return;
    void fetchReservationSettings(restaurantId).then(({ data }) => {
      if (data?.default_dwell_minutes) {
        defaultDwellRef.current = data.default_dwell_minutes;
      }
    });
  }, [restaurantId]);

  const handleFinalTranscript = useCallback(
    (transcript: string, alternatives?: string[]) => {
      setHeardText(transcript);
      const result = parseReservationVoiceTextWithAlternatives(
        transcript,
        alternatives ?? [],
      );
      if (!result.ok) {
        toast.error(result.error, {
          description: "Beispiel: Max Mustermann, 3 Personen, 18.7., 19 Uhr",
        });
        return;
      }
      setPending(result.parsed);
      setConfirmOpen(true);
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
  });

  const toggleListening = () => {
    if (listening) stop();
    else start();
  };

  const handleConfirm = async () => {
    if (!restaurantId || !pending) return;
    const result = await createReservationFromVoiceParsed({
      restaurantId,
      parsed: pending,
      defaultDwellMinutes: defaultDwellRef.current,
      isSuperadmin,
    });
    if (!result.ok) {
      toast.error(result.error);
      throw new Error(result.error);
    }
    toast.success(`Reservierung #${result.reservationNumber} angelegt.`);
    setPending(null);
    setHeardText("");
  };

  if (!mounted || !ready || !restaurantId || !supported) return null;

  const preview = pending ? formatParsedReservationVoiceLabel(pending) : null;

  return createPortal(
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

      <div
        className="pointer-events-none fixed end-4 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-[120] flex flex-col items-end gap-2 sm:end-6"
        data-reservation-voice-fab
      >
        {listening ? (
          <SpeechLiveCaption listening={listening} interim={interim} />
        ) : null}

        <button
          type="button"
          aria-label={
            listening ? "Aufnahme beenden" : "Reservierung per Sprache anlegen"
          }
          aria-pressed={listening}
          className={cn(
            "pointer-events-auto flex size-14 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95",
            brandActionButtonClassName,
            listening && "ring-4 ring-accent/30",
          )}
          onClick={toggleListening}
        >
          {listening ? (
            <Square className="size-5 fill-current" aria-hidden />
          ) : (
            <Mic className="size-6" strokeWidth={2.25} aria-hidden />
          )}
        </button>
      </div>
    </>,
    document.body,
  );
}
