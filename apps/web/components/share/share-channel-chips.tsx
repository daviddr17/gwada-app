"use client";

import Link from "next/link";
import { NewsPlatformIcon } from "@/components/news/news-platform-icon";
import type { ShareChannelPublicInfo } from "@/lib/share/share-types";
import { cn } from "@/lib/utils";
import { APP_ROUTES } from "@/lib/navigation/app-routes";

export function ShareChannelChip({
  channel,
  selected,
  onSelect,
  disabled,
}: {
  channel: ShareChannelPublicInfo;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}) {
  const isDisabled = disabled || !channel.connected;

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={onSelect}
      className={cn(
        "inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        selected && channel.connected
          ? "border-accent/50 bg-accent/15 text-foreground"
          : "border-border/60 bg-card text-muted-foreground hover:border-border hover:text-foreground",
        isDisabled && "pointer-events-none opacity-45",
      )}
      aria-pressed={selected}
      aria-disabled={isDisabled}
    >
      <NewsPlatformIcon platform={channel.platform} className="size-4" />
      <span>{channel.label}</span>
    </button>
  );
}

export function ShareChannelPicker({
  channels,
  selected,
  onToggle,
  disabled,
}: {
  channels: ShareChannelPublicInfo[];
  selected: Set<string>;
  onToggle: (key: string) => void;
  disabled?: boolean;
}) {
  const disconnected = channels.filter((c) => !c.connected);
  const connected = channels.filter((c) => c.connected);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {connected.map((channel) => (
          <ShareChannelChip
            key={channel.key}
            channel={channel}
            selected={selected.has(channel.key)}
            onSelect={() => onToggle(channel.key)}
            disabled={disabled}
          />
        ))}
      </div>
      {connected.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Noch keine Kanäle verbunden.{" "}
          <Link
            href={APP_ROUTES.settings.integrations}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            In Einstellungen verbinden
          </Link>
        </p>
      ) : null}
      {disconnected.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Nicht verbunden —{" "}
            <Link
              href={APP_ROUTES.settings.integrations}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              In Einstellungen verbinden
            </Link>
          </p>
          <div className="flex flex-wrap gap-2">
            {disconnected.map((channel) => (
              <ShareChannelChip
                key={channel.key}
                channel={channel}
                selected={false}
                onSelect={() => {}}
                disabled
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
