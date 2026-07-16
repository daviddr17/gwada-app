"use client";

import { Mic, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { ReservationVoiceCompleteSheet } from "@/components/reservations/reservation-voice-complete-sheet";
import { useIsSuperadmin } from "@/lib/hooks/use-is-superadmin";
import { useRestaurantIanaTimezone } from "@/lib/hooks/use-restaurant-iana-timezone";
import { useSpeechRecognition } from "@/lib/hooks/use-speech-recognition";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import {
  parseReservationVoiceDraftWithAlternatives,
  type ParsedReservationVoice,
  type ReservationVoiceDraft,
} from "@/lib/reservations/parse-reservation-voice-text";
import { createReservationFromVoiceParsed } from "@/lib/reservations/reservation-voice-create-client";
import { fetchReservationSettings } from "@/lib/supabase/reservation-settings-db";
import { brandActionButtonClassName } from "@/lib/ui/brand-action-button";
import {
  appMobileFabBottomClassName,
  appMobileFabButtonClassName,
  appMobileFabIconClassName,
  appMobileFabStopIconClassName,
} from "@/lib/ui/app-mobile-bottom-nav";
import { SpeechLiveCaption } from "@/lib/ui/speech-live-caption";
import { cn } from "@/lib/utils";

export function ReservationVoiceFab() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const { isSuperadmin } = useIsSuperadmin();
  const restaurantTimeZone = useRestaurantIanaTimezone(restaurantId);
  const [mounted, setMounted] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState<ReservationVoiceDraft | null>(null);
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

  const createFromParsed = useCallback(
    async (parsed: ParsedReservationVoice) => {
      if (!restaurantId) return;
      const result = await createReservationFromVoiceParsed({
        restaurantId,
        parsed,
        defaultDwellMinutes: defaultDwellRef.current,
        restaurantTimeZone,
        isSuperadmin,
      });
      if (!result.ok) {
        toast.error(result.error);
        throw new Error(result.error);
      }
      toast.success(`Reservierung #${result.reservationNumber} angelegt.`);
      setDraft(null);
    },
    [isSuperadmin, restaurantId, restaurantTimeZone],
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

  if (!mounted || !ready || !restaurantId || !supported) return null;

  return createPortal(
    <>
      <ReservationVoiceCompleteSheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) setDraft(null);
        }}
        initialDraft={draft}
        onConfirm={createFromParsed}
      />

      <div
        className={cn(
          "pointer-events-none fixed end-4 z-[120] flex flex-col items-end gap-2 sm:end-6",
          appMobileFabBottomClassName,
        )}
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
            "pointer-events-auto shadow-lg transition-transform active:scale-95",
            appMobileFabButtonClassName,
            brandActionButtonClassName,
            listening && "ring-4 ring-accent/30",
          )}
          onClick={toggleListening}
        >
          {listening ? (
            <Square className={appMobileFabStopIconClassName} aria-hidden />
          ) : (
            <Mic className={appMobileFabIconClassName} strokeWidth={2.25} aria-hidden />
          )}
        </button>
      </div>
    </>,
    document.body,
  );
}
