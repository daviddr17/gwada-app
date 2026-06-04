export type ParsedMultipartSend = {
  messageBody: string;
  files: File[];
  fields: Record<string, string>;
};

export async function parseMultipartSend(
  req: Request,
): Promise<ParsedMultipartSend | null> {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) return null;

  const form = await req.formData();
  const fields: Record<string, string> = {};
  const files: File[] = [];

  for (const [key, value] of form.entries()) {
    if (value instanceof File) {
      if (value.size > 0) files.push(value);
    } else if (typeof value === "string") {
      fields[key] = value;
    }
  }

  return {
    messageBody: (fields.messageBody ?? "").trim(),
    files,
    fields,
  };
}
