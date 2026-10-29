"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { DashboardWidgetTileSkeleton } from "@/components/dashboard/dashboard-widget-tile-skeleton";

type Props = {
  children: ReactNode;
};

type State = {
  failed: boolean;
};

/** Einzelnes Widget darf das ganze Dashboard nicht mitreißen (Chunk-/Render-Fehler). */
export class DashboardWidgetErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[dashboard:widget]", error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="rounded-2xl border border-border/40 bg-card/80 p-4 text-xs text-muted-foreground shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_rgba(15,23,42,0.07)]">
          Widget konnte nicht geladen werden.
        </div>
      );
    }
    return this.props.children;
  }
}

export function DashboardWidgetErrorBoundaryWithReset({
  widgetId,
  children,
}: {
  widgetId: string;
  children: ReactNode;
}) {
  return (
    <DashboardWidgetErrorBoundary key={widgetId}>
      {children}
    </DashboardWidgetErrorBoundary>
  );
}
