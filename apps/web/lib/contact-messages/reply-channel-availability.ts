/** Welche Zustellwege für Posteingang-Antworten (verknüpfter Kontakt) verfügbar sind. */
export function contactReplyChannels(params: {
  whatsappEnabled: boolean;
  whatsappConnected: boolean;
  emailEnabled: boolean;
  emailConnected: boolean;
  staffInviteEmailAvailable: boolean;
  facebookEnabled: boolean;
  facebookConnected: boolean;
  instagramEnabled: boolean;
  instagramConnected: boolean;
  hasPhone: boolean;
  hasEmail: boolean;
  hasFacebookId: boolean;
  hasInstagramId: boolean;
}): {
  canWhatsapp: boolean;
  canEmail: boolean;
  canFacebook: boolean;
  canInstagram: boolean;
  /** Restaurant ohne eigenes Postfach — Versand über Plattform-SMTP (contact@gwada.app). */
  emailViaPlatformFallback: boolean;
} {
  const canWhatsapp =
    params.whatsappEnabled &&
    params.whatsappConnected &&
    params.hasPhone;
  const canEmail =
    params.emailEnabled &&
    params.hasEmail &&
    (params.emailConnected || params.staffInviteEmailAvailable);
  const canFacebook =
    params.facebookEnabled &&
    params.facebookConnected &&
    params.hasFacebookId;
  const canInstagram =
    params.instagramEnabled &&
    params.instagramConnected &&
    params.hasInstagramId;
  const emailViaPlatformFallback =
    canEmail &&
    !params.emailConnected &&
    params.staffInviteEmailAvailable;

  return {
    canWhatsapp,
    canEmail,
    canFacebook,
    canInstagram,
    emailViaPlatformFallback,
  };
}
