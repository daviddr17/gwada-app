"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UnifiedNewsStoryRing } from "@/lib/news/unified-news-story";
import { cn } from "@/lib/utils";

const STORY_OPEN_MS = 340;
const STORY_CLOSE_MS = 280;
const STORY_SLIDE_MS = 220;

type Props = {
  ring: UnifiedNewsStoryRing | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function NewsStoryViewer({ ring, open, onOpenChange }: Props) {
  const [slideIndex, setSlideIndex] = useState(0);
  const [mounted, setMounted] = useState(open);
  const [presented, setPresented] = useState(false);
  const [slideVisible, setSlideVisible] = useState(true);

  const slides = ring?.slides ?? [];
  const current = slides[slideIndex];
  const hasMultiple = slides.length > 1;

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  const goPrev = useCallback(() => {
    setSlideIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setSlideIndex((i) => {
      if (i >= slides.length - 1) {
        close();
        return i;
      }
      return i + 1;
    });
  }, [slides.length, close]);

  useEffect(() => {
    if (open) {
      setMounted(true);
      if (prefersReducedMotion()) {
        setPresented(true);
        return;
      }
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setPresented(true));
      });
      return () => cancelAnimationFrame(frame);
    }

    setPresented(false);
    const timer = window.setTimeout(
      () => setMounted(false),
      prefersReducedMotion() ? 0 : STORY_CLOSE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (open) setSlideIndex(0);
  }, [open, ring?.id]);

  useEffect(() => {
    if (!mounted) return;
    const prevOverflow = document.body.style.overflow;
    const prevOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.overscrollBehavior = prevOverscroll;
    };
  }, [mounted]);

  useEffect(() => {
    setSlideVisible(false);
    const timer = window.setTimeout(
      () => setSlideVisible(true),
      prefersReducedMotion() ? 0 : 16,
    );
    return () => window.clearTimeout(timer);
  }, [slideIndex, ring?.id]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowLeft") goPrev();
      if (event.key === "ArrowRight") goNext();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, close, goPrev, goNext]);

  if (!ring || !mounted || typeof document === "undefined") return null;

  const motionReduced = prefersReducedMotion();
  const overlayMs = presented ? STORY_OPEN_MS : STORY_CLOSE_MS;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ring.title}
      className="fixed inset-0 z-[220] flex touch-manipulation flex-col bg-black"
      style={{
        opacity: presented ? 1 : 0,
        transition: motionReduced ? "none" : `opacity ${overlayMs}ms ease-out`,
      }}
    >
      <div className="relative z-20 shrink-0 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        {hasMultiple ? (
          <div className="mb-3 flex gap-1">
            {slides.map((slide, index) => (
              <span
                key={slide.id}
                className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/25"
              >
                <span
                  className={cn(
                    "block h-full rounded-full bg-white transition-[width] duration-300 ease-out",
                    index < slideIndex
                      ? "w-full"
                      : index === slideIndex
                        ? "w-full"
                        : "w-0",
                  )}
                />
              </span>
            ))}
          </div>
        ) : null}

        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ring.coverUrl}
            alt=""
            className="size-9 shrink-0 rounded-full object-cover ring-2 ring-white/70"
          />
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
            {ring.title}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 rounded-full text-white hover:bg-white/15 hover:text-white"
            onClick={close}
            aria-label="Schließen"
          >
            <X className="size-5" />
          </Button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-stretch justify-center">
        <button
          type="button"
          className="absolute inset-y-0 left-0 z-10 w-[30%] cursor-w-resize"
          onClick={goPrev}
          aria-label="Vorherige Story"
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 z-10 w-[30%] cursor-e-resize"
          onClick={goNext}
          aria-label="Nächste Story"
        />

        <div
          className="pointer-events-none relative flex w-full flex-1 items-center justify-center px-1 sm:px-4"
          style={{
            transform: presented ? "scale(1)" : "scale(0.92)",
            opacity: presented ? 1 : 0,
            transition: motionReduced
              ? "none"
              : `transform ${overlayMs}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${overlayMs}ms ease-out`,
          }}
        >
          <div
            key={current?.id ?? slideIndex}
            className="flex max-h-full w-full max-w-3xl items-center justify-center"
            style={{
              opacity: slideVisible ? 1 : 0,
              transform: slideVisible ? "scale(1)" : "scale(0.98)",
              transition: motionReduced
                ? "none"
                : `opacity ${STORY_SLIDE_MS}ms ease-out, transform ${STORY_SLIDE_MS}ms ease-out`,
            }}
          >
            {current?.kind === "video" ? (
              <video
                key={current.url}
                src={current.url}
                className="pointer-events-auto max-h-[calc(100dvh-8rem)] w-full object-contain"
                controls
                playsInline
                autoPlay
                muted
              />
            ) : current?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={current.url}
                alt=""
                className="max-h-[calc(100dvh-8rem)] w-full object-contain"
              />
            ) : null}
          </div>
        </div>
      </div>

      {current?.caption ? (
        <div className="relative z-20 shrink-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
          <p className="whitespace-pre-wrap text-sm text-white/90">{current.caption}</p>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
