"use client";

import {
  Component,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { buildEmailIframeSrcDoc } from "@/lib/email/email-body-html";
import { cn } from "@/lib/utils";

const MAX_IFRAME_HEIGHT = 480;
const HEIGHT_REMEASURE_MS = [0, 80, 250, 600, 1200];

type EmailBodyProps = {
  body: string;
  bodyHtml?: string | null;
  className?: string;
};

class EmailHtmlRenderBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

function PlainTextBody({ body, className }: { body: string; className?: string }) {
  return (
    <p className={cn("whitespace-pre-wrap break-words", className)}>{body}</p>
  );
}

function measureIframeContentHeight(doc: Document): number {
  const body = doc.body;
  const root = doc.documentElement;
  if (!body) return 0;
  return Math.max(
    body.scrollHeight,
    body.offsetHeight,
    root?.scrollHeight ?? 0,
    root?.offsetHeight ?? 0,
  );
}

function EmailHtmlIframe({
  html,
  plainFallback,
  className,
}: {
  html: string;
  plainFallback: string;
  className?: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [renderFailed, setRenderFailed] = useState(false);

  const srcDoc = useMemo(() => buildEmailIframeSrcDoc(html), [html]);

  const applyMeasuredHeight = useCallback((doc: Document) => {
    const measured = measureIframeContentHeight(doc);
    if (measured <= 0) return false;
    const next = Math.min(Math.max(measured + 4, 32), MAX_IFRAME_HEIGHT);
    setHeight((prev) => (prev === next ? prev : next));
    window.dispatchEvent(new CustomEvent("gwada:contact-chat-content-layout"));
    return true;
  }, []);

  useEffect(() => {
    setRenderFailed(false);
    setHeight(null);
  }, [srcDoc]);

  useEffect(() => {
    const frame = iframeRef.current;
    if (!frame) return;

    const disconnectObserver = () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };

    const attachObserver = (doc: Document) => {
      const body = doc.body;
      if (!body) return;
      disconnectObserver();
      const observer = new ResizeObserver(() => {
        applyMeasuredHeight(doc);
      });
      observer.observe(body);
      observerRef.current = observer;
    };

    const measure = () => {
      try {
        const doc = frame.contentDocument;
        if (!doc?.body) {
          setRenderFailed(true);
          return;
        }
        const ok = applyMeasuredHeight(doc);
        if (!ok) setRenderFailed(true);
        else attachObserver(doc);
      } catch {
        setRenderFailed(true);
      }
    };

    frame.addEventListener("load", measure);

    const timers = HEIGHT_REMEASURE_MS.map((ms) =>
      window.setTimeout(measure, ms),
    );

    return () => {
      frame.removeEventListener("load", measure);
      for (const id of timers) window.clearTimeout(id);
      disconnectObserver();
    };
  }, [srcDoc, applyMeasuredHeight]);

  if (renderFailed) {
    return <PlainTextBody body={plainFallback} className={className} />;
  }

  return (
    <iframe
      ref={iframeRef}
      title="E-Mail-Inhalt"
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      srcDoc={srcDoc}
      className={cn(
        "block w-full max-w-full border-0 bg-transparent",
        height == null && "min-h-[4rem]",
        className,
      )}
      style={{
        height: height ?? undefined,
        minHeight: height == null ? "4rem" : undefined,
        overflowY: height != null && height >= MAX_IFRAME_HEIGHT ? "auto" : undefined,
      }}
    />
  );
}

export function ContactMessageEmailBody({
  body,
  bodyHtml,
  className,
}: EmailBodyProps) {
  const trimmed = body.trim();
  const html = bodyHtml?.trim();

  if (!trimmed && !html) return null;

  if (!html) {
    return <PlainTextBody body={trimmed} className={className} />;
  }

  const fallback = trimmed || "E-Mail-Inhalt konnte nicht angezeigt werden.";

  return (
    <EmailHtmlRenderBoundary
      fallback={<PlainTextBody body={fallback} className={className} />}
    >
      <EmailHtmlIframe
        html={html}
        plainFallback={fallback}
        className={className}
      />
    </EmailHtmlRenderBoundary>
  );
}
