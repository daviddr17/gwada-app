"use client";

import { useCallback, useEffect, useState } from "react";
import {
  peekChannelConnectionsCache,
  writeChannelConnectionsCache,
} from "@/lib/contact-messages/channel-connections-cache";

export type RestaurantChannelConnections = {
  loading: boolean;
  whatsappEnabled: boolean;
  emailEnabled: boolean;
  facebookEnabled: boolean;
  instagramEnabled: boolean;
  whatsappConnected: boolean;
  emailConnected: boolean;
  facebookConnected: boolean;
  instagramConnected: boolean;
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
  const [instagramEnabled, setInstagramEnabled] = useState(false);
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [emailConnected, setEmailConnected] = useState(false);
  const [facebookConnected, setFacebookConnected] = useState(false);
  const [instagramConnected, setInstagramConnected] = useState(false);
  const [staffInviteEmailAvailable, setStaffInviteEmailAvailable] =
    useState(false);

  const applyPayload = useCallback(
    (body: {
      whatsappEnabled?: boolean;
      emailEnabled?: boolean;
      facebookEnabled?: boolean;
      instagramEnabled?: boolean;
      whatsappConnected?: boolean;
      emailConnected?: boolean;
      facebookConnected?: boolean;
      instagramConnected?: boolean;
      staffInviteEmailAvailable?: boolean;
    }) => {
      setWhatsappEnabled(Boolean(body.whatsappEnabled));
      setEmailEnabled(Boolean(body.emailEnabled));
      setFacebookEnabled(Boolean(body.facebookEnabled));
      setInstagramEnabled(Boolean(body.instagramEnabled));
      setWhatsappConnected(Boolean(body.whatsappConnected));
      setEmailConnected(Boolean(body.emailConnected));
      setFacebookConnected(Boolean(body.facebookConnected));
      setInstagramConnected(Boolean(body.instagramConnected));
      setStaffInviteEmailAvailable(Boolean(body.staffInviteEmailAvailable));
    },
    [],
  );

  const load = useCallback(async () => {
    if (!restaurantId) {
      setWhatsappEnabled(false);
      setEmailEnabled(false);
      setFacebookEnabled(false);
      setInstagramEnabled(false);
      setWhatsappConnected(false);
      setEmailConnected(false);
      setFacebookConnected(false);
      setInstagramConnected(false);
      setStaffInviteEmailAvailable(false);
      setLoading(true);
      return;
    }

    const cached = peekChannelConnectionsCache(restaurantId);
    if (cached) {
      applyPayload(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const res = await fetch(
        `/api/contact-messages/channels-status?${new URLSearchParams({ restaurantId })}`,
      );
      const body = (await res.json()) as {
        whatsappEnabled?: boolean;
        emailEnabled?: boolean;
        facebookEnabled?: boolean;
        instagramEnabled?: boolean;
        whatsappConnected?: boolean;
        emailConnected?: boolean;
        facebookConnected?: boolean;
        instagramConnected?: boolean;
        staffInviteEmailAvailable?: boolean;
      };
      if (res.ok) {
        applyPayload(body);
        writeChannelConnectionsCache(restaurantId, {
          whatsappEnabled: Boolean(body.whatsappEnabled),
          emailEnabled: Boolean(body.emailEnabled),
          facebookEnabled: Boolean(body.facebookEnabled),
          instagramEnabled: Boolean(body.instagramEnabled),
          whatsappConnected: Boolean(body.whatsappConnected),
          emailConnected: Boolean(body.emailConnected),
          facebookConnected: Boolean(body.facebookConnected),
          instagramConnected: Boolean(body.instagramConnected),
          staffInviteEmailAvailable: Boolean(body.staffInviteEmailAvailable),
        });
      }
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, [applyPayload, restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    loading,
    whatsappEnabled,
    emailEnabled,
    facebookEnabled,
    instagramEnabled,
    whatsappConnected,
    emailConnected,
    facebookConnected,
    instagramConnected,
    staffInviteEmailAvailable,
    refresh: load,
  };
}
