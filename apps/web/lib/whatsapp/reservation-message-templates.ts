export type ReservationMessageContext = {
  guestFirstName: string;
  guestLastName: string;
  partySize: number;
  startsAt: Date;
  /** IANA-Zeitzone des Restaurants für {datum}/{uhrzeit}. */
  timeZone: string;
  reservationNumber: number;
  guestPin: string;
  restaurantName?: string;
  manageUrl?: string | null;
};
