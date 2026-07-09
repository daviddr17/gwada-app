import * as React from "react";
import { isIosTouchDevice } from "@/lib/hooks/use-drawer-form-keyboard-assist";

/** Tablet + Mobil — numerische Tastatur für Personen, Telefon, Verweildauer. */
export const TOUCH_TABLET_MAX_WIDTH_PX = 1024;

function evaluateTouchTablet(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.innerWidth <= TOUCH_TABLET_MAX_WIDTH_PX ||
    window.matchMedia("(pointer: coarse)").matches ||
    isIosTouchDevice() ||
    (navigator.maxTouchPoints > 0 && window.matchMedia("(hover: none)").matches)
  );
}

export function useIsTouchTablet(): boolean {
  const [isTouchTablet, setIsTouchTablet] = React.useState(evaluateTouchTablet);

  React.useEffect(() => {
    const evaluate = () => {
      setIsTouchTablet(evaluateTouchTablet());
    };
    evaluate();
    const widthQuery = window.matchMedia(
      `(max-width: ${TOUCH_TABLET_MAX_WIDTH_PX}px)`,
    );
    const coarseQuery = window.matchMedia("(pointer: coarse)");
    widthQuery.addEventListener("change", evaluate);
    coarseQuery.addEventListener("change", evaluate);
    return () => {
      widthQuery.removeEventListener("change", evaluate);
      coarseQuery.removeEventListener("change", evaluate);
    };
  }, []);

  return isTouchTablet;
}
