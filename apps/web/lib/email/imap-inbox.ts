import "server-only";

import { ImapFlow } from "imapflow";
import { simpleParser, type ParsedMail } from "mailparser";
import { attachmentsFromParsedMail } from "@/lib/email/imap-message-attachments";
import type { ContactMessageAttachmentKind } from "@/lib/types/contact-message-attachment";
import { normalizeContactEmail } from "@/lib/contacts/normalize-contact-identity";
import type { SmtpIntegrationConfig } from "@/lib/integrations/smtp-integration-config";
import { smtpCredentialsFromConfig } from "@/lib/integrations/smtp-integration-config";

const FETCH_LIMIT = 120;
const SINCE_DAYS = 90;

export type ImapCredentials = NonNullable<
  ReturnType<typeof smtpCredentialsFromConfig>
>;

export type ImapEnvelopeMessage = {
  uid: number;
  date: Date;
  from: string;
  to: string[];
  subject: string;
  snippet: string;
  outbound: boolean;
  /** IMAP \\Seen — auch in anderen Mail-Programmen gesetzt. */
  seen: boolean;
};

export function imapMessageIsSeen(flags: Set<string> | undefined): boolean {
  if (!flags?.size) return false;
  for (const flag of flags) {
    const normalized = flag.replace(/^\\/u, "").toLowerCase();
    if (normalized === "seen") return true;
  }
  return false;
}

function extractEmailAddress(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  const m = raw.match(/<([^>]+)>/);
  const addr = (m?.[1] ?? raw).trim().toLowerCase();
  return addr.includes("@") ? addr : null;
}

function addressesFromEnvelope(
  list: { address?: string; name?: string }[] | undefined,
): string[] {
  if (!list?.length) return [];
  return list
    .map((a) => a.address?.trim().toLowerCase())
    .filter((a): a is string => Boolean(a && a.includes("@")));
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function bodyTextFromParsed(mail: ParsedMail, maxLen = 8000): string {
  const text = mail.text?.trim();
  if (text) {
    return text.length > maxLen ? `${text.slice(0, maxLen - 1)}…` : text;
  }
  const html =
    typeof mail.html === "string"
      ? stripHtmlToText(mail.html)
      : Array.isArray(mail.html)
        ? stripHtmlToText(mail.html.join(" "))
        : "";
  if (html) {
    return html.length > maxLen ? `${html.slice(0, maxLen - 1)}…` : html;
  }
  return mail.subject?.trim() || "—";
}

function snippetFromParsed(mail: ParsedMail): string {
  const full = bodyTextFromParsed(mail, 400);
  const line = full.replace(/\s+/g, " ").trim();
  if (line && line !== mail.subject?.trim()) {
    return line.slice(0, 200);
  }
  return line || mail.subject?.trim() || "—";
}

async function withImapClient<T>(
  creds: ImapCredentials,
  fn: (client: ImapFlow) => Promise<T>,
): Promise<{ data: T | null; error: string | null }> {
  const client = new ImapFlow({
    host: creds.imapHost,
    port: creds.imapPort,
    secure: creds.imapPort === 993,
    auth: {
      user: creds.email,
      pass: creds.password,
    },
    logger: false,
  });

  try {
    await client.connect();
    const data = await fn(client);
    await client.logout();
    return { data, error: null };
  } catch (e) {
    try {
      await client.logout();
    } catch {
      /* ignore */
    }
    const msg = e instanceof Error ? e.message : "imap_error";
    return { data: null, error: msg };
  }
}

export async function fetchImapRecentEnvelopes(
  creds: ImapCredentials,
): Promise<{ data: ImapEnvelopeMessage[]; error: string | null }> {
  const account = creds.email.trim().toLowerCase();
  const since = new Date();
  since.setDate(since.getDate() - SINCE_DAYS);

  const result = await withImapClient(creds, async (client) => {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const uids = await client.search({ since }, { uid: true });
      const uidList = Array.isArray(uids) ? uids : [];
      const slice = uidList.slice(-FETCH_LIMIT);
      if (slice.length === 0) return [];

      const messages: ImapEnvelopeMessage[] = [];
      for await (const msg of client.fetch(
        slice,
        { envelope: true, uid: true, flags: true },
        { uid: true },
      )) {
        const env = msg.envelope;
        if (!env || !msg.uid) continue;
        const from =
          extractEmailAddress(env.from?.[0]?.address) ??
          extractEmailAddress(env.sender?.[0]?.address) ??
          "";
        const to = addressesFromEnvelope(env.to);
        const cc = addressesFromEnvelope(env.cc);
        const allTo = [...to, ...cc];
        const subject = env.subject?.trim() || "(Ohne Betreff)";
        const date = env.date ?? new Date();
        const outbound = from === account;

        messages.push({
          uid: msg.uid,
          date,
          from,
          to: allTo,
          subject,
          snippet: subject,
          outbound,
          seen: imapMessageIsSeen(msg.flags),
        });
      }
      return messages;
    } finally {
      lock.release();
    }
  });

  if (result.error || !result.data) {
    return { data: [], error: result.error };
  }
  return { data: result.data, error: null };
}

export type ImapThreadBodyEntry = {
  body: string;
  subject: string;
  date: Date;
  outbound: boolean;
  attachmentMeta: {
    index: number;
    fileName: string;
    mimeType: string;
    byteSize: number | null;
  }[];
};

export async function fetchImapThreadBodies(
  creds: ImapCredentials,
  uids: number[],
): Promise<{
  bodies: Map<number, ImapThreadBodyEntry>;
  error: string | null;
}> {
  const account = creds.email.trim().toLowerCase();
  const map = new Map<number, ImapThreadBodyEntry>();
  if (uids.length === 0) return { bodies: map, error: null };

  const result = await withImapClient(creds, async (client) => {
    const lock = await client.getMailboxLock("INBOX");
    try {
      for await (const msg of client.fetch(
        uids,
        { uid: true, source: true, envelope: true },
        { uid: true },
      )) {
        if (!msg.uid || !msg.source) continue;
        const parsed = await simpleParser(msg.source);
        const from =
          extractEmailAddress(parsed.from?.text) ??
          extractEmailAddress(msg.envelope?.from?.[0]?.address) ??
          "";
        const parsedAttachments = attachmentsFromParsedMail(parsed);
        map.set(msg.uid, {
          body: bodyTextFromParsed(parsed),
          subject:
            parsed.subject?.trim() || msg.envelope?.subject?.trim() || "",
          date: parsed.date ?? msg.envelope?.date ?? new Date(),
          outbound: from === account,
          attachmentMeta: parsedAttachments.map((a) => ({
            index: a.index,
            fileName: a.fileName,
            mimeType: a.mimeType,
            byteSize: a.byteSize,
          })),
        });
      }
    } finally {
      lock.release();
    }
  });

  if (result.error) return { bodies: map, error: result.error };
  return { bodies: map, error: null };
}

export type ImapMessageSnippetPreview = {
  snippet: string;
  attachmentKind?: ContactMessageAttachmentKind;
};

/** Kurzvorschau für Listen (nur angegebene UIDs, begrenzte Größe). */
export async function fetchImapMessageSnippets(
  creds: ImapCredentials,
  uids: number[],
): Promise<Map<number, ImapMessageSnippetPreview>> {
  const snippets = new Map<number, ImapMessageSnippetPreview>();
  if (uids.length === 0) return snippets;

  const result = await withImapClient(creds, async (client) => {
    const lock = await client.getMailboxLock("INBOX");
    try {
      for await (const msg of client.fetch(
        uids,
        {
          uid: true,
          source: { start: 0, maxLength: 24_000 },
          envelope: true,
        },
        { uid: true },
      )) {
        if (!msg.uid || !msg.source) continue;
        const parsed = await simpleParser(msg.source);
        const attachments = attachmentsFromParsedMail(parsed);
        const attachmentKind = attachments.some((a) =>
          a.mimeType.toLowerCase().startsWith("image/"),
        )
          ? "image"
          : attachments.length > 0
            ? "file"
            : undefined;
        snippets.set(msg.uid, {
          snippet: snippetFromParsed(parsed),
          attachmentKind,
        });
      }
    } finally {
      lock.release();
    }
  });

  void result;
  return snippets;
}

/** \\Seen auf dem Server setzen oder entfernen (Sync mit anderen Mail-Clients). */
export async function imapSetMessagesSeen(
  creds: ImapCredentials,
  uids: number[],
  seen: boolean,
): Promise<{ error: string | null }> {
  if (uids.length === 0) return { error: null };

  const result = await withImapClient(creds, async (client) => {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const flag = "\\Seen";
      if (seen) {
        await client.messageFlagsAdd(uids, [flag], { uid: true });
      } else {
        await client.messageFlagsRemove(uids, [flag], { uid: true });
      }
    } finally {
      lock.release();
    }
  });

  return { error: result.error };
}

/** Einzelnen Anhang einer Nachricht laden (für Download-Proxy). */
export async function fetchImapAttachmentContent(
  creds: ImapCredentials,
  uid: number,
  index: number,
): Promise<{
  data: { fileName: string; mimeType: string; bytes: Buffer } | null;
  error: string | null;
}> {
  const result = await withImapClient(creds, async (client) => {
    const lock = await client.getMailboxLock("INBOX");
    try {
      for await (const msg of client.fetch(
        [uid],
        { uid: true, source: true },
        { uid: true },
      )) {
        if (!msg.uid || !msg.source) return null;
        const parsed = await simpleParser(msg.source);
        const attachments = attachmentsFromParsedMail(parsed);
        const hit = attachments.find((a) => a.index === index);
        if (!hit) return null;
        return {
          fileName: hit.fileName,
          mimeType: hit.mimeType,
          bytes: hit.content,
        };
      }
      return null;
    } finally {
      lock.release();
    }
  });

  if (result.error) return { data: null, error: result.error };
  return { data: result.data, error: null };
}

/** Externe Gegenstelle einer Nachricht (nicht das Restaurant-Konto). */
export function imapCounterpartyEmail(
  msg: ImapEnvelopeMessage,
  accountEmail: string,
): string | null {
  const account = accountEmail.trim().toLowerCase();
  if (!msg.outbound && msg.from && msg.from !== account) {
    return normalizeContactEmail(msg.from);
  }
  for (const t of msg.to) {
    const n = normalizeContactEmail(t);
    if (n && n !== account) return n;
  }
  return null;
}
