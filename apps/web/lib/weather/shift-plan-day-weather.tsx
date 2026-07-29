"use client";

import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  Droplets,
  Moon,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { WeatherAmbienceKind } from "@/lib/weather/weather-ambience-kind";
import {
  shiftPlanWeatherTitle,
  type ShiftPlanDayWeather,
} from "@/lib/weather/shift-plan-day-weather-data";

export type { ShiftPlanDayWeather } from "@/lib/weather/shift-plan-day-weather-data";
export {
  parseShiftPlanWeatherByDate,
  shiftPlanWeatherTitle,
} from "@/lib/weather/shift-plan-day-weather-data";

export const shiftPlanDayHeaderWeatherSlotClassName =
  "mt-0.5 flex min-h-[1.375rem] w-full shrink-0 flex-col items-center justify-center gap-px leading-none";

const WEATHER_KIND_STYLES: Record<
  WeatherAmbienceKind,
  { Icon: LucideIcon; className: string }
> = {
  clear: { Icon: Sun, className: "text-amber-500" },
  cloudy: { Icon: Cloud, className: "text-slate-400" },
  rain: { Icon: CloudRain, className: "text-sky-500" },
  storm: { Icon: CloudLightning, className: "text-violet-500" },
  snow: { Icon: CloudSnow, className: "text-sky-300" },
  fog: { Icon: CloudFog, className: "text-slate-400" },
  night: { Icon: Moon, className: "text-indigo-400" },
};

export function ShiftPlanWeatherIcon({
  kind,
  className,
}: {
  kind: WeatherAmbienceKind;
  className?: string;
}) {
  const style = WEATHER_KIND_STYLES[kind] ?? WEATHER_KIND_STYLES.cloudy;
  const { Icon, className: colorClass } = style;
  return <Icon className={cn("shrink-0", colorClass, className)} aria-hidden />;
}

function ShiftPlanWeatherTemps({ weather }: { weather: ShiftPlanDayWeather }) {
  return (
    <span className="inline-flex items-baseline gap-0.5 tabular-nums">
      <span className="text-[11px] font-semibold text-foreground">
        {weather.tempMaxC}°
      </span>
      {weather.tempMinC != null ? (
        <span className="text-[8px] text-muted-foreground">
          {weather.tempMinC}°
        </span>
      ) : null}
    </span>
  );
}

function ShiftPlanWeatherPrecip({ prob }: { prob: number }) {
  return (
    <span className="inline-flex items-center gap-px text-sky-600 dark:text-sky-400">
      <Droplets className="size-2 shrink-0 opacity-80" aria-hidden />
      <span className="text-[8px] font-medium tabular-nums">{prob}%</span>
    </span>
  );
}

export function ShiftPlanDayWeatherRow({
  weather,
  inline = false,
}: {
  weather?: ShiftPlanDayWeather;
  /** Neben Feiertag in Monatskarten statt unter der Datumszeile. */
  inline?: boolean;
}) {
  if (!weather) {
    if (inline) return null;
    return <div className={shiftPlanDayHeaderWeatherSlotClassName} aria-hidden />;
  }

  const showPrecip =
    weather.precipProb != null && weather.precipProb > 0;
  const title = shiftPlanWeatherTitle(weather);

  if (inline) {
    return (
      <span
        className="inline-flex shrink-0 items-center gap-1 leading-none"
        title={title}
      >
        <ShiftPlanWeatherIcon kind={weather.kind} className="size-3" />
        <ShiftPlanWeatherTemps weather={weather} />
        {showPrecip ? (
          <ShiftPlanWeatherPrecip prob={weather.precipProb!} />
        ) : null}
      </span>
    );
  }

  return (
    <div className={shiftPlanDayHeaderWeatherSlotClassName} title={title}>
      <div className="flex items-center gap-0.5">
        <ShiftPlanWeatherIcon kind={weather.kind} className="size-3" />
        <ShiftPlanWeatherTemps weather={weather} />
      </div>
      {showPrecip ? (
        <ShiftPlanWeatherPrecip prob={weather.precipProb!} />
      ) : (
        <span className="h-[0.625rem]" aria-hidden />
      )}
    </div>
  );
}
