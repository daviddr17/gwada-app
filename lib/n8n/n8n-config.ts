export type N8nServerConfig = {
  webhookUrl: string;
  webhookSecret: string | null;
};

/** n8n-Webhook (SMTP Send Email Node im Workflow). */
export function getN8nEmailConfig(): N8nServerConfig | null {
  const webhookUrl = process.env.N8N_RESERVATION_EMAIL_WEBHOOK_URL?.trim();
  if (!webhookUrl) return null;
  const webhookSecret = process.env.N8N_WEBHOOK_SECRET?.trim() || null;
  return { webhookUrl, webhookSecret };
}

export function isN8nEmailConfigured(): boolean {
  return getN8nEmailConfig() !== null;
}
