"use client";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export type EmbedProfilePlatformToggleItem<T extends string> = {
  id: T;
  label: string;
  /** Plattform kann ein-/ausgeschaltet werden (z. B. verbunden oder Gwada). */
  togglable: boolean;
  icon?: React.ReactNode;
  hint?: string;
};

function isPlatformEnabled<T extends string>(
  values: Record<T, boolean | undefined>,
  id: T,
): boolean {
  return values[id] !== false;
}

export function EmbedProfilePlatformToggles<T extends string>({
  platforms,
  values,
  onChange,
  className,
}: {
  platforms: EmbedProfilePlatformToggleItem<T>[];
  values: Record<T, boolean | undefined>;
  onChange: (next: Record<T, boolean>) => void;
  className?: string;
}) {
  const setPlatformEnabled = (id: T, enabled: boolean) => {
    onChange({ ...values, [id]: enabled } as Record<T, boolean>);
  };

  return (
    <ul
      className={cn(
        "space-y-2 rounded-xl border border-border/50 bg-muted/15 p-3",
        className,
      )}
    >
      {platforms.map((platform) => (
        <li
          key={platform.id}
          className="flex items-center justify-between gap-3"
        >
          <span className="inline-flex min-w-0 items-center gap-2 text-sm">
            {platform.icon}
            <span className="truncate">{platform.label}</span>
            {platform.hint ? (
              <span className="text-xs text-muted-foreground">{platform.hint}</span>
            ) : null}
          </span>
          <Switch
            checked={isPlatformEnabled(values, platform.id)}
            disabled={!platform.togglable}
            onCheckedChange={(value) =>
              setPlatformEnabled(platform.id, value === true)
            }
            aria-label={`${platform.label} in Profil & Einbindung`}
          />
        </li>
      ))}
    </ul>
  );
}
