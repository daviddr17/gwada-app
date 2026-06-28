"use client";

import {
  isBusinessCardShapeDecoration,
  type BusinessCardShapeDecoration,
} from "@/lib/restaurant/business-card-shape-decoration";
import type { BusinessCardDecoration } from "@/lib/restaurant/business-card-design";
import { businessCardVisualOpacity } from "@/lib/restaurant/business-card-design";
import { businessCardDecorationImageUrl } from "@/lib/restaurant/business-card-decoration-document";
import { normalizeHex } from "@/lib/theme/color-utils";
import { DEFAULT_ACCENT_HEX } from "@/lib/theme/constants";
import { cn } from "@/lib/utils";

function ShapeSvg({ decoration }: { decoration: BusinessCardShapeDecoration }) {
  const color = normalizeHex(decoration.color) ?? DEFAULT_ACCENT_HEX;
  const { opacity, filled, lineWidth, kind } = decoration;
  const stroke = color;
  const sw = lineWidth;

  if (kind === "line") {
    return (
      <svg
        className="size-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        <line
          x1="2"
          y1="50"
          x2="98"
          y2="50"
          stroke={stroke}
          strokeOpacity={opacity}
          strokeWidth={sw}
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (kind === "circle") {
    return (
      <svg
        className="size-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        {filled ? (
          <ellipse
            cx="50"
            cy="50"
            rx="48"
            ry="48"
            fill={stroke}
            fillOpacity={opacity}
          />
        ) : (
          <ellipse
            cx="50"
            cy="50"
            rx="46"
            ry="46"
            fill="none"
            stroke={stroke}
            strokeOpacity={opacity}
            strokeWidth={sw}
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
    );
  }

  return (
    <svg
      className="size-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      {filled ? (
        <rect
          x="2"
          y="2"
          width="96"
          height="96"
          rx="4"
          ry="4"
          fill={stroke}
          fillOpacity={opacity}
        />
      ) : (
        <rect
          x="3"
          y="3"
          width="94"
          height="94"
          rx="4"
          ry="4"
          fill="none"
          stroke={stroke}
          strokeOpacity={opacity}
          strokeWidth={sw}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}

export function BusinessCardDecorationVisual({
  decoration,
  restaurantId,
  className,
}: {
  decoration: BusinessCardDecoration;
  restaurantId: string;
  className?: string;
}) {
  if (isBusinessCardShapeDecoration(decoration)) {
    return (
      <div className={cn("pointer-events-none size-full", className)}>
        <ShapeSvg decoration={decoration} />
      </div>
    );
  }

  const imageUrl = businessCardDecorationImageUrl(restaurantId, decoration);
  const imageOpacity = businessCardVisualOpacity(decoration.opacity);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl ?? undefined}
      alt=""
      className={cn("pointer-events-none size-full object-contain", className)}
      style={{ opacity: imageOpacity }}
      draggable={false}
    />
  );
}
