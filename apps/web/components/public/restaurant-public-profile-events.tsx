"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { CalendarDays, PartyPopper } from "lucide-react";
import { EmbedEventsWidget } from "@/components/embed/embed-events-widget";
import {
  EmbedSlidingSegmentTabs,
  type EmbedSlidingSegmentTab,
} from "@/components/embed/embed-sliding-segment-tabs";
import type { EmbedReservationProfileTermsSheet } from "@/components/embed/embed-reservation-widget";
import { RestaurantPublicProfileModuleSkeleton } from "@/components/public/restaurant-public-profile-module-skeleton";
import type { PublicEmbedEvents } from "@/lib/events/public-events-server";
import { publicCountries, type PublicEmbedRestaurant } from "@/lib/reservations/public-embed-shared";

const EmbedEventInquiryWidget = dynamic(
  () =>
    import("@/components/embed/embed-event-inquiry-widget").then(
      (mod) => mod.EmbedEventInquiryWidget,
    ),
  { loading: () => <RestaurantPublicProfileModuleSkeleton variant="form" /> },
);

type EventsProfileTab = "dates" | "inquiry";

const EVENTS_PROFILE_TABS: readonly EmbedSlidingSegmentTab<EventsProfileTab>[] =
  [
    { id: "dates", label: "Termine", icon: CalendarDays },
    { id: "inquiry", label: "Anfrage", icon: PartyPopper },
  ];

export function RestaurantPublicProfileEvents({
  events,
  reservation,
  reservationLoading,
  reservationError,
  reservationTermsSheet,
  onInquiryVisible,
}: {
  events: PublicEmbedEvents;
  reservation: PublicEmbedRestaurant | null;
  reservationLoading: boolean;
  reservationError: string | null;
  reservationTermsSheet: EmbedReservationProfileTermsSheet;
  onInquiryVisible?: () => void;
}) {
  const [tab, setTab] = useState<EventsProfileTab>("dates");
  const countries = publicCountries();

  const handleTabChange = useCallback(
    (next: EventsProfileTab) => {
      setTab(next);
      if (next === "inquiry") onInquiryVisible?.();
    },
    [onInquiryVisible],
  );

  return (
    <div className="space-y-4">
      <EmbedSlidingSegmentTabs
        tabs={EVENTS_PROFILE_TABS}
        value={tab}
        onChange={handleTabChange}
        aria-label="Events"
      />
      {tab === "dates" ? (
        <EmbedEventsWidget
          variant="profileSheet"
          accentHex={events.accentHex}
          connectedPlatforms={events.connectedPlatforms}
          items={events.items}
          pastItems={events.pastItems}
          showAllPlatformFilter={events.showAllPlatformFilter}
        />
      ) : reservationLoading && !reservation ? (
        <RestaurantPublicProfileModuleSkeleton variant="form" />
      ) : reservationError || !reservation ? (
        <p className="text-sm text-muted-foreground">
          Das Anfrageformular konnte gerade nicht geladen werden.
        </p>
      ) : (
        <EmbedEventInquiryWidget
          config={reservation}
          countries={countries}
          variant="profileSheet"
          profileTermsSheet={reservationTermsSheet}
        />
      )}
    </div>
  );
}
