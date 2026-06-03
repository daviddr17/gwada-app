export type PlatformOAuthAvailability = {
  /** Superadmin-Schalter „aktiv“. */
  googleEnabled: boolean;
  /** Aktiv + Client-ID + Secret — Login/Verknüpfen möglich. */
  googleReady: boolean;
  /** Superadmin-Schalter „aktiv“. */
  appleEnabled: boolean;
  /** Aktiv + Client-ID + Secret — Login/Verknüpfen möglich. */
  appleReady: boolean;
};
