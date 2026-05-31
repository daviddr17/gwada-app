"use client";

import { useCallback, useEffect, useState } from "react";

export type RestaurantChannelConnections = {
  loading: boolean;
  whatsappEnabled: boolean;
  emailEnabled: boolean;
  facebookEnabled: boolean;
  whatsappConnected: boolean;
  emailConnected: boolean;
  facebookConnected: boolean;
  /** Restaurant-SMTP oder Plattform-Mail für direkten Versand */
  staffInviteEmailAvailable: boolean;
  refresh: () => void;
};

export function useRestaurantChannelConnections(
  restaurantId: string | null,
): RestaurantChannelConnections {
  const [loading, setLoading] = useState(true);
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [facebookEnabled, setFacebookEnabled] = useState(false);
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [emailConnected, setEmailConnected] = useState(false);
  const [facebookConnected, setFacebookConnected] = useState(false);
  const [staffInviteEmailAvailable, setStaffInviteEmailAvailable] =
    useState(false);

  const load = useCallback(async () => {
    if (!restaurantId) {
      setWhatsappEnabled(false);
      setEmailEnabled(false);
      setFacebookEnabled(false);
      setWhatsappConnected(false);
      setEmailConnected(false);
      setStaffInviteEmailAvailable(false);
      setLoading(true);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/contact-messages/channels-status?${new URLSearchParams({ restaurantId })}`,
      );
      const body = (await res.json()) as {
        whatsappEnabled?: boolean;
        emailEnabled?: boolean;
        facebookEnabled?: boolean;
        whatsappConnected?: boolean;
        emailConnected?: boolean;
        facebookConnected?: boolean;
        staffInviteEmailAvailable?: boolean;
      };
      if (res.ok) {
        setWhatsappEnabled(Boolean(body.whatsappEnabled));
        setEmailEnabled(Boolean(body.emailEnabled));
        setFacebookEnabled(Boolean(body.facebookEnabled));
        setWhatsappConnected(Boolean(body.whatsappConnected));
        setEmailConnected(Boolean(body.emailConnected));
        setFacebookConnected(Boolean(body.facebookConnected));
        setStaffInviteEmailAvailable(
          Boolean(body.staffInviteEmailAvailable),
        );
      }
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    loading,
    whatsappEnabled,
    emailEnabled,
    facebookEnabled,
    whatsappConnected,
    emailConnected,
    facebookConnected,
    staffInviteEmailAvailable,
    refresh: load,
  };
}
