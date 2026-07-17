"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { RestaurantSetupWizardOverlay } from "@/components/onboarding/restaurant-setup-wizard-overlay";
import { useMyRestaurants } from "@/lib/hooks/use-my-restaurants";
import { useWorkspaceAuthSession } from "@/lib/contexts/workspace-auth-session-context";
import { useWorkspaceRestaurantContext } from "@/lib/contexts/workspace-restaurant-context";

type RestaurantSetupWizardContextValue = {
  openWizard: () => void;
  closeWizard: () => void;
};

const RestaurantSetupWizardContext =
  createContext<RestaurantSetupWizardContextValue | null>(null);

export function useRestaurantSetupWizard(): RestaurantSetupWizardContextValue {
  const ctx = useContext(RestaurantSetupWizardContext);
  if (!ctx) {
    throw new Error(
      "useRestaurantSetupWizard erfordert RestaurantSetupWizardProvider.",
    );
  }
  return ctx;
}

export function useRestaurantSetupWizardOptional(): RestaurantSetupWizardContextValue | null {
  return useContext(RestaurantSetupWizardContext);
}

/**
 * Auto-opens the setup overlay when the signed-in user has no restaurant yet.
 * Also exposes `openWizard` for „Neues Restaurant“ in the workspace.
 */
export function RestaurantSetupWizardProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { user, ready: authReady } = useWorkspaceAuthSession();
  const { ready: workspaceReady, restaurantId, refresh } =
    useWorkspaceRestaurantContext();
  const { rows, loading: restaurantsLoading, refresh: refreshList } =
    useMyRestaurants();

  const [open, setOpen] = useState(false);
  const [required, setRequired] = useState(false);
  const [autoPrompted, setAutoPrompted] = useState(false);

  const openWizard = useCallback(() => {
    setRequired(false);
    setOpen(true);
  }, []);

  const closeWizard = useCallback(() => {
    setOpen(false);
    setRequired(false);
  }, []);

  useEffect(() => {
    if (!authReady || !workspaceReady || restaurantsLoading) return;
    if (!user) {
      setAutoPrompted(false);
      return;
    }
    if (autoPrompted) return;
    if (restaurantId || rows.length > 0) {
      setAutoPrompted(true);
      return;
    }
    setRequired(true);
    setOpen(true);
    setAutoPrompted(true);
  }, [
    authReady,
    workspaceReady,
    restaurantsLoading,
    user,
    restaurantId,
    rows.length,
    autoPrompted,
  ]);

  const value = useMemo(
    () => ({ openWizard, closeWizard }),
    [openWizard, closeWizard],
  );

  return (
    <RestaurantSetupWizardContext.Provider value={value}>
      {children}
      <RestaurantSetupWizardOverlay
        open={open}
        required={required && rows.length === 0 && !restaurantId}
        onOpenChange={(next) => {
          if (!next && required && rows.length === 0 && !restaurantId) {
            return;
          }
          setOpen(next);
          if (!next) setRequired(false);
        }}
        onCompleted={() => {
          setRequired(false);
          void refresh();
          refreshList();
        }}
      />
    </RestaurantSetupWizardContext.Provider>
  );
}
