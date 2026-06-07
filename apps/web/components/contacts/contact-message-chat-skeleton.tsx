"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function BubbleSkeleton({
  align,
  lines,
  className,
}: {
  align: "start" | "end";
  lines: Array<{ width: string }>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex max-w-[min(100%,20rem)] flex-col gap-1",
        align === "end" ? "ml-auto items-end" : "items-start",
        className,
      )}
    >
      <div
        className={cn(
          "w-full space-y-1.5 rounded-2xl px-3 py-2.5",
          align === "end"
            ? "rounded-br-md bg-accent/10"
            : "rounded-bl-md border border-border/40 bg-muted/25",
        )}
      >
        {lines.map((line, i) => (
          <Skeleton
            key={i}
            className={cn("h-3 rounded-md", line.width, align === "end" && "ml-auto")}
          />
        ))}
      </div>
      <Skeleton
        className={cn(
          "h-2.5 w-14 rounded-md",
          align === "end" ? "mr-1" : "ml-1",
        )}
      />
    </div>
  );
}

/** Ladeplatzhalter im Stil eines Chat-Verlaufs (unten ausgerichtet wie WhatsApp). */
export function ContactMessageChatSkeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <ul
      className={cn(
        "flex min-h-[12rem] flex-col justify-end gap-3 py-1",
        className,
      )}
      aria-busy
      aria-label="Nachrichten werden geladen"
    >
      <li>
        <BubbleSkeleton
          align="start"
          lines={[{ width: "w-[88%]" }, { width: "w-[62%]" }]}
        />
      </li>
      <li>
        <BubbleSkeleton align="end" lines={[{ width: "w-[76%]" }]} />
      </li>
      <li>
        <BubbleSkeleton
          align="start"
          lines={[{ width: "w-[70%]" }]}
        />
      </li>
      <li>
        <BubbleSkeleton
          align="end"
          lines={[{ width: "w-[92%]" }, { width: "w-[48%]" }]}
        />
      </li>
    </ul>
  );
}
