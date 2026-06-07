import type { ContactCreateDraft } from "@/lib/contact-messages/draft-from-waha-chat";
import { normalizeContactEmail } from "@/lib/contacts/normalize-contact-identity";

export function draftFromEmailChat(params: {
  email: string;
  displayName: string;
}): ContactCreateDraft {
  const email = normalizeContactEmail(params.email) ?? params.email.trim();
  const name = params.displayName.trim();
  const nameIsEmail =
    name.length > 0 && normalizeContactEmail(name) === email;

  let firstName = "";
  let lastName = "";
  if (name && !nameIsEmail) {
    const parts = name.split(/\s+/).filter(Boolean);
    firstName = parts[0] ?? "";
    lastName = parts.slice(1).join(" ");
  } else {
    const local = email.split("@")[0] ?? "";
    firstName = local.replace(/[._-]+/g, " ").trim() || "Gast";
  }

  return {
    firstName: firstName || "Gast",
    lastName,
    emails: [{ email, label: "E-Mail" }],
  };
}
