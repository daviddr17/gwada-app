"use client";

import { useCallback } from "react";
import {
  useDisplayTimeTodoGate,
  DisplayTimeTodoPopup,
  type DisplayPrepareAndGate,
} from "@/components/display/modules/display-time-todo-popup";

export type { DisplayPrepareAndGate, DisplayShiftGateAction } from "@/components/display/modules/display-time-todo-popup";

export function useDisplayShiftGates() {
  const todoGate = useDisplayTimeTodoGate();

  const prepareAndGate = useCallback<DisplayPrepareAndGate>(
    async (displayAction) => todoGate.prepareAndGate(displayAction),
    [todoGate.prepareAndGate],
  );

  const preparePinLoginGate = useCallback(async (): Promise<void> => {
    await todoGate.preparePinLoginGateAsync();
  }, [todoGate.preparePinLoginGateAsync]);

  return {
    prepareAndGate,
    preparePinLoginGate,
    todoPopupProps: todoGate.popupProps,
  };
}

export { DisplayTimeTodoPopup };
