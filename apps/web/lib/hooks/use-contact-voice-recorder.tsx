"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { setWahaTypingClient } from "@/lib/contact-messages/waha-typing-client";
import { Button } from "@/components/ui/button";

const MAX_VOICE_SECONDS = 120;

function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function pickRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t));
}

function voiceFileExtension(mimeType: string): string {
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mp4")) return "m4a";
  return "webm";
}

export function useContactVoiceRecorder({
  enabled,
  whatsappPresence,
  onVoiceReady,
}: {
  enabled: boolean;
  whatsappPresence?: { restaurantId: string; chatId: string } | null;
  /** Nach Stopp: fertige Datei für den Composer-Anhang. */
  onVoiceReady: (file: File, durationSeconds: number) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef("audio/webm");
  const timerRef = useRef<number | null>(null);
  const secondsRef = useRef(0);
  const onVoiceReadyRef = useRef(onVoiceReady);

  useEffect(() => {
    onVoiceReadyRef.current = onVoiceReady;
  }, [onVoiceReady]);

  const cleanupStream = useCallback(() => {
    for (const track of streamRef.current?.getTracks() ?? []) {
      track.stop();
    }
    streamRef.current = null;
  }, []);

  const stopPresenceRecording = useCallback(() => {
    if (!whatsappPresence) return;
    void setWahaTypingClient({
      restaurantId: whatsappPresence.restaurantId,
      chatId: whatsappPresence.chatId,
      action: "recording_stop",
    });
  }, [whatsappPresence]);

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cancelRecording = useCallback(() => {
    clearTimer();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      try {
        recorder.requestData();
      } catch {
        /* ignore */
      }
      recorder.stop();
    }
    mediaRecorderRef.current = null;
    cleanupStream();
    stopPresenceRecording();
    setRecording(false);
    setSeconds(0);
    secondsRef.current = 0;
  }, [cleanupStream, clearTimer, stopPresenceRecording]);

  const startRecording = useCallback(async () => {
    if (!enabled || recording) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return;
    }
    const mimeType = pickRecorderMimeType();
    if (!mimeType) return;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    mimeTypeRef.current = mimeType;
    chunksRef.current = [];

    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onstop = () => {
      cleanupStream();
      stopPresenceRecording();
      clearTimer();
      setRecording(false);

      const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
      mediaRecorderRef.current = null;
      chunksRef.current = [];

      if (blob.size <= 0) {
        setSeconds(0);
        secondsRef.current = 0;
        return;
      }

      const ext = voiceFileExtension(mimeTypeRef.current);
      const file = new File([blob], `sprachnachricht.${ext}`, {
        type: blob.type || mimeTypeRef.current,
      });
      const durationSeconds = Math.max(1, secondsRef.current);
      onVoiceReadyRef.current(file, durationSeconds);
      setSeconds(0);
      secondsRef.current = 0;
    };

    recorder.start(250);
    setRecording(true);
    setSeconds(0);
    secondsRef.current = 0;
    timerRef.current = window.setInterval(() => {
      setSeconds((prev) => {
        const next = prev + 1;
        secondsRef.current = next;
        if (next >= MAX_VOICE_SECONDS) {
          try {
            recorder.requestData();
          } catch {
            /* ignore */
          }
          recorder.stop();
        }
        return next;
      });
    }, 1000);

    if (whatsappPresence) {
      void setWahaTypingClient({
        restaurantId: whatsappPresence.restaurantId,
        chatId: whatsappPresence.chatId,
        action: "recording",
      });
    }
  }, [
    cleanupStream,
    clearTimer,
    enabled,
    recording,
    stopPresenceRecording,
    whatsappPresence,
  ]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    try {
      recorder.requestData();
    } catch {
      /* ignore */
    }
    recorder.stop();
  }, []);

  useEffect(
    () => () => {
      clearTimer();
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;
        recorder.stop();
      }
      for (const track of streamRef.current?.getTracks() ?? []) {
        track.stop();
      }
    },
    [clearTimer],
  );

  return {
    recording,
    seconds,
    canRecord: enabled && typeof MediaRecorder !== "undefined",
    startRecording,
    stopRecording,
    cancelRecording,
    formatDuration,
  };
}

export function ContactMessageVoiceRecorderBar({
  recording,
  seconds,
  onStop,
  onCancel,
  formatDuration,
}: {
  recording: boolean;
  seconds: number;
  onStop: () => void;
  onCancel: () => void;
  formatDuration: (seconds: number) => string;
}) {
  if (!recording) return null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2">
      <span className="relative flex size-2.5 shrink-0">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive opacity-60" />
        <span className="relative inline-flex size-2.5 rounded-full bg-destructive" />
      </span>
      <Mic className="size-4 shrink-0 text-destructive" aria-hidden />
      <span className="min-w-0 flex-1 text-sm tabular-nums">
        Aufnahme {formatDuration(seconds)}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-xl"
        onClick={onCancel}
      >
        Abbrechen
      </Button>
      <Button
        type="button"
        size="icon-sm"
        className="rounded-full"
        aria-label="Aufnahme beenden"
        onClick={onStop}
      >
        <Square className="size-4 fill-current" />
      </Button>
    </div>
  );
}
