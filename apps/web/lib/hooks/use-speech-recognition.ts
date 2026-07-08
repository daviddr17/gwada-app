"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionCtor = new () => BrowserSpeechRecognition;

type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onresult: ((ev: {
    resultIndex: number;
    results: {
      length: number;
      [index: number]: {
        isFinal: boolean;
        0?: { transcript?: string };
      };
    };
  }) => void) | null;
  start: () => void;
  stop: () => void;
};

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

function speechRecognitionErrorMessage(error: string): string {
  switch (error) {
    case "not-allowed":
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
      return "Spracherkennung ist in diesem Browser nicht verfügbar — bitte Safari oder Chrome verwenden.";
    case "language-not-supported":
      return "Deutsch (de-DE) wird in diesem Browser nicht unterstützt.";
    default:
      return "Spracherkennung fehlgeschlagen.";
  }
}

export function speechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() != null;
}

export function useSpeechRecognition(params?: {
  lang?: string;
  onFinal?: (transcript: string) => void;
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

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      onErrorRef.current?.(
        "Spracherkennung wird in diesem Browser nicht unterstützt.",
      );
      return;
    }

    if (isEmbeddedPreviewBrowser()) {
      onErrorRef.current?.(speechRecognitionErrorMessage("network"));
      return;
    }

    stop();
    setInterim("");

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognition.onerror = (ev) => {
      if (ev.error === "aborted") return;
      onErrorRef.current?.(speechRecognitionErrorMessage(ev.error));
      setListening(false);
    };
    recognition.onresult = (ev) => {
      let interimText = "";
      let finalText = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const chunk = ev.results[i]?.[0]?.transcript ?? "";
        if (ev.results[i]?.isFinal) finalText += chunk;
        else interimText += chunk;
      }
      if (interimText) setInterim(interimText.trim());
      if (finalText.trim()) {
        setInterim("");
        onFinalRef.current?.(finalText.trim());
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      onErrorRef.current?.("Spracherkennung konnte nicht gestartet werden.");
      setListening(false);
    }
  }, [lang, stop]);

  useEffect(() => () => stop(), [stop]);

  return {
    supported,
    listening,
    interim,
    start,
    stop,
  };
}
