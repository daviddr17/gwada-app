export type ReservationMessageContext = {
  guestFirstName: string;
  guestLastName: string;
  partySize: number;
  startsAt: Date;
  reservationNumber: number;
  guestPin: string;
  restaurantName?: string;
  manageUrl?: string | null;
};
