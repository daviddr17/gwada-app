"use client";

import type { ReactNode } from "react";
import { IntegrationCollapsiblePanel } from "@/components/ui/integration-collapsible-panel";

/** Einheitliche Superadmin-Feld-Labels (wie SecretInput). */
export const superadminIntegrationFieldLabelClassName =
  "text-xs text-muted-foreground";

/** Einheitliche Höhe/Stil für Client-ID und vergleichbare Inputs. */
export const superadminIntegrationInputClassName =
  "h-11 rounded-xl font-mono text-sm";

export function SuperadminIntegrationPanel({
  title,
  description,
  icon,
  badges,
  headerTrailing,
  defaultOpen = false,
  children,
}: {
  title: ReactNode;
  description: string;
  icon: ReactNode;
  badges?: ReactNode;
  headerTrailing?: ReactNode;
  defaultOpen?: boolean;
  children?: ReactNode;
}) {
  return (
    <IntegrationCollapsiblePanel
      title={title}
      description={description}
      icon={icon}
      badges={badges}
      headerTrailing={headerTrailing}
      defaultOpen={defaultOpen}
    >
      {children}
    </IntegrationCollapsiblePanel>
  );
}
