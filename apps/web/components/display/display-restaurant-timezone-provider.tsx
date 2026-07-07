"use client";

import { createContext, useContext } from "react";
import { DEFAULT_RESTAURANT_TIMEZONE } from "@/lib/restaurant/restaurant-timezone";

const DisplayRestaurantTimezoneContext = createContext(
  DEFAULT_RESTAURANT_TIMEZONE,
);

export function DisplayRestaurantTimezoneProvider({
  timezone,
  children,
}: {
  timezone: string;
  children: React.ReactNode;
}) {
  return (
    <DisplayRestaurantTimezoneContext.Provider
      value={timezone.trim() || DEFAULT_RESTAURANT_TIMEZONE}
    >
      {children}
    </DisplayRestaurantTimezoneContext.Provider>
  );
}

export function useDisplayRestaurantTimezone(): string {
  return useContext(DisplayRestaurantTimezoneContext);
}
