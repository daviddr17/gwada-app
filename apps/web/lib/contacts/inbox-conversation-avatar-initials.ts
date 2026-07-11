import { contactThreadAvatarInitials } from "@/lib/contacts/contact-thread-avatar-initials";

/** Listen-Avatar: keine „+“-Platzhalter bei Telefonnummern. */
export function inboxConversationAvatarInitials(displayName: string): string {
  const trimmed = displayName.trim();
  if (!trimmed) return "?";

  if (trimmed.startsWith("+")) {
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length >= 2) {
      return digits.slice(-2);
    }
    return "☎";
  }

  const fromPerson = contactThreadAvatarInitials({ displayName: trimmed });
  if (fromPerson !== "?" && !fromPerson.startsWith("+")) {
    return fromPerson;
  }

  for (const ch of trimmed) {
    if (/[\p{L}]/u.test(ch)) {
      return ch.toLocaleUpperCase("de-DE");
    }
  }

  return trimmed.slice(0, 1).toLocaleUpperCase("de-DE") || "?";
}
