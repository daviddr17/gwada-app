/** Redact secrets before persisting cron/outbox errors or logging them. */
export function sanitizeOpsText(text: string, maxLen = 240): string {
  let out = text;
  out = out.replace(/Bearer\s+[A-Za-z0-9._\-+/]+=*/gi, "Bearer ***");
  out = out.replace(/CRON_SECRET=[^\s&]+/gi, "CRON_SECRET=***");
  out = out.replace(/service_role[=:\s]+[A-Za-z0-9._\-]+/gi, "service_role=***");
  out = out.replace(/api[_-]?key[=:\s]+["']?[^"'\s]+/gi, "api_key=***");
  out = out.replace(/apikey[=:\s]+["']?[^"'\s]+/gi, "apikey=***");
  out = out.replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9._-]+/g, "***jwt***");
  out = out.replace(/sk-[A-Za-z0-9]{16,}/g, "sk-***");
  return out.slice(0, maxLen);
}
