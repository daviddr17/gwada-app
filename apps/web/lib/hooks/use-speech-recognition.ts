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

let sharedIosRecognition: BrowserSpeechRecognition | null = null;
let heldMicStream: MediaStream | null = null;
let micWarmupDone = false;
let iosPreloadDone = false;

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

/** Safari-WebKit (Tab oder PWA). */
export function isSafariWebKitBrowser(): boolean {
  return isIosWebKitBrowser() || isMacOsSafariBrowser();
}

/** @deprecated Nur noch Erkennung — kein Block mehr; iOS-PWA nutzt Held-Mic-Workaround. */
export function isSpeechRecognitionBlockedInStandalonePwa(): boolean {
  return isIosWebKitBrowser() && isStandalonePwaClient();
}

export function speechRecognitionBlockedHint(): string | null {
  return null;
}

function speechRecognitionErrorMessage(error: string): string {
  switch (error) {
    case "not-allowed":
      if (isSafariWebKitBrowser()) {
        return "Mikrofon erlauben: Einstellungen → Safari → Websites → Mikrofon → gwada.app auf „Erlauben“.";
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
      if (isSafariWebKitBrowser()) {
        return "Spracherkennung: Mikrofon unter Safari → Einstellungen → Websites für gwada.app erlauben.";
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

export function speechRecognitionUsable(): boolean {
  if (!speechRecognitionSupported()) return false;
  if (isEmbeddedPreviewBrowser()) return false;
  return true;
}

function unlockSafariAudioContext(): void {
  if (typeof window === "undefined") return;
  try {
    const Ctx =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
    void ctx.resume();
  } catch {
    /* optional */
  }
}

async function holdMicrophoneForSpeech(): Promise<boolean> {
  if (!shouldHoldMicrophoneForSpeech()) return true;
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return true;
  }
  if (heldMicStream?.active) return true;

  try {
    heldMicStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
    return true;
  } catch {
    return false;
  }
}

function releaseHeldMicrophone(): void {
  for (const track of heldMicStream?.getTracks() ?? []) {
    track.stop();
  }
  heldMicStream = null;
}

function stopSafariRecognition(recognition: BrowserSpeechRecognition): void {
  if (isSafariWebKitBrowser()) {
    try {
      recognition.start();
    } catch {
      /* bereits aktiv */
    }
  }
  try {
    recognition.stop();
  } catch {
    /* ignore */
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

type SpeechResultEvent = NonNullable<BrowserSpeechRecognition["onresult"]> extends (
  ev: infer E,
) => void
  ? E
  : never;

/** Safari liefert oft nur Interim-Ergebnisse — ohne Fallback „Keine Sprache erkannt“. */
function extractBestTranscript(ev: SpeechResultEvent): {
  transcript: string;
  alternatives: string[];
} {
  const final = extractFinalWithAlternatives(ev);
  if (final.transcript) return final;

  let combined = "";
  for (let i = 0; i < ev.results.length; i++) {
    const result = ev.results[i];
    combined += result?.[0]?.transcript ?? "";
  }

  return { transcript: combined.trim(), alternatives: [] };
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

function shouldReuseIosRecognitionSingleton(): boolean {
  return isIosWebKitBrowser() && !isStandalonePwaClient();
}

function shouldHoldMicrophoneForSpeech(): boolean {
  /** iPad-PWA: getUserMedia blockiert oft die Web-Speech-API — nur Safari-Tab nutzt Held-Mic. */
  return isSafariWebKitBrowser() && !isStandalonePwaClient();
}

function createRecognition(
  Ctor: SpeechRecognitionCtor,
  lang: string,
): BrowserSpeechRecognition {
  if (shouldReuseIosRecognitionSingleton() && sharedIosRecognition) {
    sharedIosRecognition.lang = lang;
    return sharedIosRecognition;
  }

  const recognition = new Ctor();
  recognition.lang = lang;
  recognition.interimResults = true;
  recognition.maxAlternatives = 5;
  recognition.continuous = isIosWebKitBrowser();

  if (shouldReuseIosRecognitionSingleton()) {
    sharedIosRecognition = recognition;
  }

  return recognition;
}

function preloadIosRecognition(Ctor: SpeechRecognitionCtor, lang: string): void {
  if (
    iosPreloadDone ||
    !isIosWebKitBrowser() ||
    isStandalonePwaClient()
  ) {
    return;
  }
  iosPreloadDone = true;
  const recognition = new Ctor();
  recognition.lang = lang;
  recognition.continuous = false;
  recognition.interimResults = false;
  try {
    recognition.start();
    window.setTimeout(() => {
      try {
        recognition.stop();
      } catch {
        /* ignore */
      }
    }, 100);
  } catch {
    /* ignore — echte Session folgt direkt danach */
  }
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
  const [supported] = useState(() => speechRecognitionUsable());
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const safariFinalizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const safariAudioEndedRef = useRef(false);
  const sessionDeliveredRef = useRef(false);
  const latestResultsEventRef = useRef<SpeechResultEvent | null>(null);
  const lastHeardTranscriptRef = useRef("");

  const clearSafariFinalizeTimer = useCallback(() => {
    if (safariFinalizeTimerRef.current != null) {
      clearTimeout(safariFinalizeTimerRef.current);
      safariFinalizeTimerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    clearSafariFinalizeTimer();
    const recognition = recognitionRef.current;
    if (recognition) {
      stopSafariRecognition(recognition);
    }
    recognitionRef.current = null;
    if (isStandalonePwaClient() && isIosWebKitBrowser()) {
      sharedIosRecognition = null;
    }
    safariAudioEndedRef.current = false;
    sessionDeliveredRef.current = false;
    latestResultsEventRef.current = null;
    lastHeardTranscriptRef.current = "";
    releaseHeldMicrophone();
    setListening(false);
  }, [clearSafariFinalizeTimer]);

  const deliverFinalTranscript = useCallback(
    (transcript: string, alternatives?: string[]) => {
      if (!transcript) {
        onErrorRef.current?.(speechRecognitionErrorMessage("no-speech"));
        return;
      }
      sessionDeliveredRef.current = true;
      setInterim("");
      onFinalRef.current?.(transcript, alternatives);
    },
    [],
  );

  const scheduleSafariFinalize = useCallback(
    (recognition: BrowserSpeechRecognition) => {
      const finalize = () => {
        clearSafariFinalizeTimer();
        const ev = latestResultsEventRef.current;
        const { transcript, alternatives } = ev
          ? extractBestTranscript(ev)
          : { transcript: lastHeardTranscriptRef.current.trim(), alternatives: [] as string[] };
        stopSafariRecognition(recognition);
        recognitionRef.current = null;
        safariAudioEndedRef.current = false;
        releaseHeldMicrophone();
        setListening(false);
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

    clearSafariFinalizeTimer();
    const previous = recognitionRef.current;
    if (previous) {
      stopSafariRecognition(previous);
    }
    recognitionRef.current = null;
    setInterim("");
    safariAudioEndedRef.current = false;
    sessionDeliveredRef.current = false;
    latestResultsEventRef.current = null;
    lastHeardTranscriptRef.current = "";

    const recognition = createRecognition(Ctor, lang);
    const useSafariWebKitWorkaround =
      isSafariWebKitBrowser() && !isEmbeddedPreviewBrowser();

    recognition.onstart = () => setListening(true);
    recognition.onend = () => {
      clearSafariFinalizeTimer();
      if (!sessionDeliveredRef.current) {
        const ev = latestResultsEventRef.current;
        const transcript = ev
          ? extractBestTranscript(ev).transcript
          : lastHeardTranscriptRef.current.trim();
        if (transcript) {
          deliverFinalTranscript(transcript);
        } else {
          releaseHeldMicrophone();
        }
      } else {
        releaseHeldMicrophone();
      }
      setListening(false);
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
      }
      safariAudioEndedRef.current = false;
    };
    recognition.onerror = (ev) => {
      if (ev.error === "aborted") return;
      if (sessionDeliveredRef.current) return;
      if (ev.error === "no-speech") {
        const fallback = lastHeardTranscriptRef.current.trim();
        if (fallback) {
          clearSafariFinalizeTimer();
          stopSafariRecognition(recognition);
          recognitionRef.current = null;
          safariAudioEndedRef.current = false;
          releaseHeldMicrophone();
          setListening(false);
          deliverFinalTranscript(fallback);
          return;
        }
      }
      onErrorRef.current?.(speechRecognitionErrorMessage(ev.error));
      setInterim("");
      releaseHeldMicrophone();
      setListening(false);
    };

    if (useSafariWebKitWorkaround) {
      recognition.onaudioend = () => {
        safariAudioEndedRef.current = true;
      };
    }

    recognition.onresult = (ev) => {
      latestResultsEventRef.current = ev;
      const interimText = extractInterimTranscript(ev);
      const best = extractBestTranscript(ev).transcript;
      if (interimText) setInterim(interimText);
      else if (best) setInterim(best);

      if (best) lastHeardTranscriptRef.current = best;

      if (useSafariWebKitWorkaround) {
        scheduleSafariFinalize(recognition);
        return;
      }

      const { transcript, alternatives } = extractFinalWithAlternatives(ev);
      if (transcript) {
        stopSafariRecognition(recognition);
        recognitionRef.current = null;
        releaseHeldMicrophone();
        setListening(false);
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
      releaseHeldMicrophone();
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

    setListening(true);
    setInterim("Hört zu …");
    unlockSafariAudioContext();

    void (async () => {
      if (!micWarmupDone && isSafariWebKitBrowser() && !isStandalonePwaClient()) {
        micWarmupDone = true;
        try {
          if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));
          }
        } catch {
          /* optional */
        }
      }

      const micReady = await holdMicrophoneForSpeech();
      if (!micReady) {
        setListening(false);
        setInterim("");
        onErrorRef.current?.(speechRecognitionErrorMessage("not-allowed"));
        return;
      }

      preloadIosRecognition(Ctor, lang);
      startRecognition();
    })();
  }, [lang, startRecognition]);

  useEffect(() => () => stop(), [stop]);

  useEffect(() => {
    const onHide = () => {
      if (document.hidden) stop();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [stop]);

  return {
    supported,
    listening,
    interim,
    start,
    stop,
  };
}
