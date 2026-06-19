"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import type { UnifiedNewsStoryRing } from "@/lib/news/unified-news-story";
import { cn } from "@/lib/utils";

type Props = {
  ring: UnifiedNewsStoryRing | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function NewsStoryViewer({ ring, open, onOpenChange }: Props) {
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    if (open) setSlideIndex(0);
  }, [open, ring?.id]);

  const slides = ring?.slides ?? [];
  const current = slides[slideIndex];
  const hasMultiple = slides.length > 1;

  const goPrev = useCallback(() => {
    setSlideIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setSlideIndex((i) => Math.min(slides.length - 1, i + 1));
  }, [slides.length]);

  if (!ring) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
      <DrawerContent className="max-h-[95dvh] pb-safe">
        <DrawerHeader className="flex flex-row items-center justify-between gap-2 text-left">
          <DrawerTitle className="truncate">{ring.title}</DrawerTitle>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 rounded-full"
            onClick={() => onOpenChange(false)}
            aria-label="Schließen"
          >
            <X className="size-4" />
          </Button>
        </DrawerHeader>

        <div className="relative flex min-h-[50dvh] flex-col px-4 pb-6">
          {hasMultiple ? (
            <div className="mb-3 flex gap-1">
              {slides.map((slide, index) => (
                <span
                  key={slide.id}
                  className={cn(
                    "h-0.5 flex-1 rounded-full transition-colors",
                    index <= slideIndex ? "bg-accent" : "bg-muted",
                  )}
                />
              ))}
            </div>
          ) : null}

          <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-2xl bg-black/90">
            {current?.kind === "video" ? (
              <video
                src={current.url}
                className="max-h-[60dvh] w-full object-contain"
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
                className="max-h-[60dvh] w-full object-contain"
              />
            ) : null}

            {hasMultiple ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon-sm"
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full opacity-90"
                  disabled={slideIndex <= 0}
                  onClick={goPrev}
                  aria-label="Vorherige Story"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon-sm"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full opacity-90"
                  disabled={slideIndex >= slides.length - 1}
                  onClick={goNext}
                  aria-label="Nächste Story"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </>
            ) : null}
          </div>

          {current?.caption ? (
            <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">{current.caption}</p>
          ) : null}

          {hasMultiple ? (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {slideIndex + 1}/{slides.length}
            </p>
          ) : null}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
