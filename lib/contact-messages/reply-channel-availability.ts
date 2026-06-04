/** Welche Zustellwege für Posteingang-Antworten (verknüpfter Kontakt) verfügbar sind. */
export function contactReplyChannels(params: {
  whatsappEnabled: boolean;
  whatsappConnected: boolean;
  emailEnabled: boolean;
  emailConnected: boolean;
  staffInviteEmailAvailable: boolean;
  hasPhone: boolean;
  hasEmail: boolean;
}): {
  canWhatsapp: boolean;
  canEmail: boolean;
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
  const emailViaPlatformFallback =
    canEmail &&
    !params.emailConnected &&
    params.staffInviteEmailAvailable;

  return { canWhatsapp, canEmail, emailViaPlatformFallback };
}
