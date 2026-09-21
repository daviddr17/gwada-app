/** API payload für Kanal-Verbindungen (channels-status + inbox). */
export type RestaurantChannelConnectionsPayload = {
  whatsappEnabled: boolean;
  emailEnabled: boolean;
  facebookEnabled: boolean;
  instagramEnabled: boolean;
  whatsappConnected: boolean;
  emailConnected: boolean;
  facebookConnected: boolean;
  instagramConnected: boolean;
  staffInviteEmailAvailable: boolean;
};
