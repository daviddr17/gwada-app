export type MetaGraphErrorContext = {
  platform?: "facebook" | "instagram";
  feature?: "news" | "messages";
};

/** Meta-Rohfehler in verständliche Hinweise für die UI übersetzen. */
export function formatMetaGraphError(
  message: string | null | undefined,
  context: MetaGraphErrorContext = {},
): string {
  const raw = message?.trim() ?? "";
  if (!raw) return "Meta-API nicht erreichbar.";

  const lower = raw.toLowerCase();
  const platformLabel =
    context.platform === "instagram" ? "Instagram" : "Facebook";

  if (lower.includes("does not have the capability")) {
    if (context.feature === "messages") {
      if (context.platform === "instagram") {
        return `${platformLabel}-DMs: Die Meta-App hat keine Freigabe für Instagram Messaging (App Review: instagram_manage_messages). Nach Advanced Access unter Einstellungen → Integrationen erneut verbinden.`;
      }
      return `${platformLabel}-Messenger: Die Meta-App hat keine Freigabe für Messaging (App Review: pages_messaging). Nach Advanced Access unter Einstellungen → Integrationen erneut verbinden.`;
    }
    return `${platformLabel}: Die Meta-App hat für diesen Aufruf keine Freigabe (App Review / Advanced Access prüfen).`;
  }

  if (
    lower.includes("unknown error has occurred") ||
    lower.includes("(#")
  ) {
    if (context.feature === "news") {
      return `${platformLabel} News: Meta-API-Fehler — Verbindung unter Einstellungen → Integrationen prüfen und ggf. erneut verbinden (pages_read_engagement / instagram_basic).`;
    }
    if (context.feature === "messages") {
      return `${platformLabel}-Chats: Meta-API-Fehler — Messaging-Berechtigungen und App-Review-Status prüfen.`;
    }
    return `${platformLabel}: Meta-API-Fehler — Integration erneut verbinden.`;
  }

  if (lower.includes("permission") || lower.includes("oauth")) {
    return `${platformLabel}: Fehlende Berechtigung — unter Einstellungen → Integrationen erneut verbinden.`;
  }

  return raw;
}

export function metaScopeMissingMessage(params: {
  platform: "facebook" | "instagram";
  feature: "news" | "messages";
  scopeId: string;
  scopeLabel: string;
}): string {
  const platformLabel =
    params.platform === "instagram" ? "Instagram" : "Facebook";
  const featureLabel = params.feature === "messages" ? "Nachrichten" : "News";
  return `${platformLabel} ${featureLabel}: Berechtigung „${params.scopeLabel}“ fehlt — unter Einstellungen → Integrationen erneut verbinden.`;
}
