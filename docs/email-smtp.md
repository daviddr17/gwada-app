# E-Mail-Versand (SMTP aus der App)

Reservierungen, Kontakt-Inbox, Team-Einladungen sowie Auth-Mails (Magic Link, Passwort zurücksetzen) werden **direkt aus dem Next.js-Server** versendet (`lib/email/send-via-smtp.ts`, nodemailer).

## Zugangsdaten

| Kontext | Quelle |
|--------|--------|
| Plattform (Auth-Mails) | Superadmin → E-Mail / SMTP |
| Restaurant (Gäste, Einladungen) | Einstellungen → Integrationen → E-Mail (eigenes SMTP oder Plattform-Fallback) |

SMTP-Passwörter liegen nur in der DB (Service-Role), nie im Client-Bundle.

## Technik

- Absender-Auflösung: `lib/email/email-delivery.ts` (`resolveEmailSender`)
- HTML-Layout: `lib/email/transactional-email-layout.ts`
- Reservierungen: `lib/reservations/reservation-email-dispatch.ts` → `sendReservationEmail`

Geplanter Versand (Erinnerung / Danke): Cron `GET /api/cron/reservation-email`.

## Platform-Newsletter

Superadmin → Newsletter. Opt-in-Empfänger, Batches über Cron `GET /api/cron/newsletter-send` (alle 2 Min. mit notification-deliver). Layout: `lib/email/newsletter-email-layout.ts` (anders als Transaktionsmails). Absender: Platform-SMTP (`contact@gwada.app`).
