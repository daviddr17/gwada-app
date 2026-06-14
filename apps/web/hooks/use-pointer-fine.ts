"use client";

import * as React from "react";

/** Desktop / Maus: feiner Pointer; Touch-Geräte: meist false → z. B. keine Scroll-Pfeile. */
export function usePointerFine() {
  const [fine, setFine] = React.useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(pointer: fine)").matches;
  });

  React.useEffect(() => {
    const mq = window.matchMedia("(pointer: fine)");
    const apply = () => setFine(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return fine;
}
