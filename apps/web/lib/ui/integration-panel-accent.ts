/** Markenfarben für Integrations-Karten (Hover-Border abgeschwächt). */
export const INTEGRATION_PANEL_ACCENT = {
  whatsapp: "#25D366",
  facebook: "#1877F2",
  instagram: "#E4405F",
  google_business: "#4285F4",
  google_oauth: "#4285F4",
  email: "#6366f1",
  lexoffice: "#00A88F",
  tripadvisor: "#34E0A1",
  apple_business_connect: "#1d1d1f",
  weather: "#0ea5e9",
  fiskaly: "#64748b",
} as const;

export type IntegrationPanelAccentKey = keyof typeof INTEGRATION_PANEL_ACCENT;

export function integrationPanelAccentBorderColor(color: string): string {
  return `${color}44`;
}

export function integrationPanelAccentForKey(key: string): string | undefined {
  if (Object.prototype.hasOwnProperty.call(INTEGRATION_PANEL_ACCENT, key)) {
    return INTEGRATION_PANEL_ACCENT[key as IntegrationPanelAccentKey];
  }
  return undefined;
}
