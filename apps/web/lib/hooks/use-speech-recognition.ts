"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isStandalonePwaClient } from "@/lib/pwa/is-standalone-pwa-client";

type SpeechRecognitionCtor = new () => BrowserSpeechRecognition;

type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onaudioend: (() => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onresult: ((ev: {
    resultIndex: number;
    results: {
      length: number;
      [index: number]: {
        isFinal: boolean;
        length: number;
        [altIndex: number]: { transcript?: string } | undefined;
      };
    };
  }) => void) | null;
  start: () => void;
  stop: () => void;
};

const SAFARI_FINALIZE_MS = 750;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Cursor-Vorschau / Electron — Web Speech API scheitert meist mit `network`. */
export function isEmbeddedPreviewBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Cursor\/|Electron\//i.test(navigator.userAgent);
}

/** iOS/iPadOS Safari (nicht Chrome/Firefox in-app). */
export function isIosWebKitBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua);
  const webkit = /WebKit/.test(ua);
  const notOther = !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return ios && webkit && notOther;
}

/** macOS Safari (nicht iOS, nicht Chrome/Edge/Firefox). */
export function isMacOsSafariBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (isIosWebKitBrowser()) return false;
  if (!/Macintosh|Mac OS X/.test(ua)) return false;
  if (/Chrome|Chromium|Edg|OPR|Firefox/.test(ua)) return false;
  return /Safari/.test(ua);
}

/** Safari-WebKit (Tab oder PWA) — für Workarounds, ohne PWA zu blockieren. */
export function isSafariWebKitBrowser(): boolean {
  return isIosWebKitBrowser() || isMacOsSafariBrowser();
}

function speechRecognitionErrorMessage(error: string): string {
  switch (error) {
    case "not-allowed":
      if (isSafariWebKitBrowser() && !isStandalonePwaClient()) {
        return "Mikrofon in Safari erlauben: Einstellungen → Websites → Mikrofon → gwada.app auf „Erlauben“.";
      }
      return "Mikrofon-Zugriff verweigert.";
    case "no-speech":
      return "Keine Sprache erkannt — bitte erneut versuchen.";
    case "audio-capture":
      return "Kein Mikrofon gefunden oder Mikrofon ist belegt.";
    case "network":
      return isEmbeddedPreviewBrowser()
        ? "Spracheingabe funktioniert im Cursor-Vorschaubrowser nicht. Bitte Safari oder Chrome verwenden."
        : "Spracherkennung konnte den Sprachdienst nicht erreichen — Internetverbindung prüfen.";
    case "service-not-allowed":
      if (isMacOsSafariBrowser()) {
        return "Safari benötigt die System-Diktierfunktion: Systemeinstellungen → Tastatur → Diktat aktivieren. Danach Mikrofon für gwada.app unter Safari → Einstellungen → Websites erlauben.";
      }
      if (isSafariWebKitBrowser() && !isStandalonePwaClient()) {
        return "Spracherkennung in Safari: Mikrofon unter Safari → Einstellungen → Websites für gwada.app erlauben. Alternativ die installierte App (Home-Bildschirm) nutzen.";
      }
      return "Spracherkennung ist in diesem Browser nicht verfügbar.";
    case "language-not-supported":
      return "Deutsch (de-DE) wird in diesem Browser nicht unterstützt.";
    default:
      return "Spracherkennung fehlgeschlagen.";
  }
}

export function speechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() != null;
}

/** Mikrofon + Sprach-Privilegien in Safari-Tab vor SpeechRecognition anfordern. */
async function primeSafariSpeechAccess(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  try {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));
    }
  } catch {
    // optional — nicht blockieren
  }

  if (!navigator.mediaDevices?.getUserMedia) return true;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) track.stop();
    return true;
  } catch {
    return false;
  }
}

function extractFinalWithAlternatives(ev: {
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      length: number;
      0?: { transcript?: string };
      [altIndex: number]: { transcript?: string } | undefined;
    };
  };
}): { transcript: string; alternatives: string[] } {
  let finalText = "";
  const finalAlternatives: string[] = [];

  for (let i = 0; i < ev.results.length; i++) {
    const result = ev.results[i];
    if (!result?.isFinal) continue;
    finalText += result[0]?.transcript ?? "";
    for (let j = 0; j < result.length; j++) {
      const alt = result[j]?.transcript?.trim();
      if (alt) finalAlternatives.push(alt);
    }
  }

  const primary = finalText.trim();
  const alternatives = [
    ...new Set(
      finalAlternatives.filter(
        (alt) => alt.toLowerCase() !== primary.toLowerCase(),
      ),
    ),
  ];

  return { transcript: primary, alternatives };
}

function extractInterimTranscript(ev: {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      0?: { transcript?: string };
    };
  };
}): string {
  let interimText = "";
  for (let i = ev.resultIndex; i < ev.results.length; i++) {
    const result = ev.results[i];
    if (result?.isFinal) continue;
    interimText += result?.[0]?.transcript ?? "";
  }
  return interimText.trim();
}

export function useSpeechRecognition(params?: {
  lang?: string;
  onFinal?: (transcript: string, alternatives?: string[]) => void;
  onError?: (message: string) => void;
}) {
  const lang = params?.lang ?? "de-DE";
  const onFinalRef = useRef(params?.onFinal);
  const onErrorRef = useRef(params?.onError);
  onFinalRef.current = params?.onFinal;
  onErrorRef.current = params?.onError;

  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [supported] = useState(() => speechRecognitionSupported());
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const safariFinalizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const safariAudioEndedRef = useRef(false);

  const clearSafariFinalizeTimer = useCallback(() => {
    if (safariFinalizeTimerRef.current != null) {
      clearTimeout(safariFinalizeTimerRef.current);
      safariFinalizeTimerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    clearSafariFinalizeTimer();
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    safariAudioEndedRef.current = false;
    setListening(false);
  }, [clearSafariFinalizeTimer]);

  const deliverFinalTranscript = useCallback(
    (transcript: string, alternatives?: string[]) => {
      if (!transcript) return;
      setInterim("");
      onFinalRef.current?.(transcript, alternatives);
    },
    [],
  );

  const scheduleSafariFinalize = useCallback(
    (recognition: BrowserSpeechRecognition, ev: Parameters<NonNullable<BrowserSpeechRecognition["onresult"]>>[0]) => {
      const finalize = () => {
        clearSafariFinalizeTimer();
        const { transcript, alternatives } = extractFinalWithAlternatives(ev);
        recognition.stop();
        deliverFinalTranscript(
          transcript,
          alternatives.length > 0 ? alternatives : undefined,
        );
      };

      if (safariAudioEndedRef.current) {
        finalize();
        return;
      }

      clearSafariFinalizeTimer();
      safariFinalizeTimerRef.current = setTimeout(finalize, SAFARI_FINALIZE_MS);
    },
    [clearSafariFinalizeTimer, deliverFinalTranscript],
  );

  const startRecognition = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      onErrorRef.current?.(
        "Spracherkennung wird in diesem Browser nicht unterstützt.",
      );
      return;
    }

    stop();
    setInterim("");
    safariAudioEndedRef.current = false;

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 5;

    const useSafariTabWorkaround =
      isSafariWebKitBrowser() &&
      !isEmbeddedPreviewBrowser() &&
      !isStandalonePwaClient();

    recognition.onstart = () => setListening(true);
    recognition.onend = () => {
      clearSafariFinalizeTimer();
      setListening(false);
      recognitionRef.current = null;
      safariAudioEndedRef.current = false;
    };
    recognition.onerror = (ev) => {
      if (ev.error === "aborted") return;
      onErrorRef.current?.(speechRecognitionErrorMessage(ev.error));
      setListening(false);
    };

    if (useSafariTabWorkaround) {
      recognition.onaudioend = () => {
        safariAudioEndedRef.current = true;
      };
    }

    recognition.onresult = (ev) => {
      const interimText = extractInterimTranscript(ev);
      if (interimText) setInterim(interimText);

      if (useSafariTabWorkaround) {
        scheduleSafariFinalize(recognition, ev);
        return;
      }

      const { transcript, alternatives } = extractFinalWithAlternatives(ev);
      if (transcript) {
        deliverFinalTranscript(
          transcript,
          alternatives.length > 0 ? alternatives : undefined,
        );
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      onErrorRef.current?.("Spracherkennung konnte nicht gestartet werden.");
      setListening(false);
    }
  }, [
    clearSafariFinalizeTimer,
    deliverFinalTranscript,
    lang,
    scheduleSafariFinalize,
    stop,
  ]);

  const start = useCallback(() => {
    if (isEmbeddedPreviewBrowser()) {
      onErrorRef.current?.(speechRecognitionErrorMessage("network"));
      return;
    }

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      onErrorRef.current?.(
        "Spracherkennung wird in diesem Browser nicht unterstützt.",
      );
      return;
    }

    const needsSafariPrime =
      isSafariWebKitBrowser() && !isStandalonePwaClient();

    if (!needsSafariPrime) {
      startRecognition();
      return;
    }

    void (async () => {
      const primed = await primeSafariSpeechAccess();
      if (!primed) {
        onErrorRef.current?.(speechRecognitionErrorMessage("not-allowed"));
        return;
      }
      startRecognition();
    })();
  }, [startRecognition]);

  useEffect(() => () => stop(), [stop]);

  return {
    supported,
    listening,
    interim,
    start,
    stop,
  };
}
