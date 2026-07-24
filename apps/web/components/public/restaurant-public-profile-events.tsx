"use client";

import { EmbedEventsWidget } from "@/components/embed/embed-events-widget";
import type { PublicEmbedEvents } from "@/lib/events/public-events-server";

export function RestaurantPublicProfileEvents({
  events,
}: {
  events: PublicEmbedEvents;
}) {
  return (
    <EmbedEventsWidget
      variant="profileSheet"
      accentHex={events.accentHex}
      connectedPlatforms={events.connectedPlatforms}
      items={events.items}
      pastItems={events.pastItems}
      showAllPlatformFilter={events.showAllPlatformFilter}
    />
  );
}
