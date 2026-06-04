import { parseMultipartSend } from "@/lib/contact-messages/parse-multipart-send";
import {
  parseOutboundAttachmentFiles,
  type OutboundAttachmentFile,
} from "@/lib/contact-messages/outbound-attachment-files";

export type ParsedSendRequestBody<T extends Record<string, unknown>> = {
  fields: T;
  messageBody: string;
  attachmentFiles: OutboundAttachmentFile[];
};

export async function parseSendRequestBody<T extends Record<string, unknown>>(
  req: Request,
  mapFields: (raw: Record<string, string>) => T,
): Promise<
  | { ok: true; data: ParsedSendRequestBody<T> }
  | { ok: false; error: string }
> {
  const multipart = await parseMultipartSend(req);
  if (multipart) {
    const parsedFiles = await parseOutboundAttachmentFiles(multipart.files);
    if (!parsedFiles.ok) return { ok: false, error: parsedFiles.error };
    return {
      ok: true,
      data: {
        fields: mapFields(multipart.fields),
        messageBody: multipart.messageBody,
        attachmentFiles: parsedFiles.files,
      },
    };
  }

  const json = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const strFields: Record<string, string> = {};
  for (const [k, v] of Object.entries(json)) {
    if (typeof v === "string") strFields[k] = v;
  }
  const messageBody =
    (typeof json.messageBody === "string" ? json.messageBody : "").trim();

  return {
    ok: true,
    data: {
      fields: mapFields(strFields),
      messageBody,
      attachmentFiles: [],
    },
  };
}
