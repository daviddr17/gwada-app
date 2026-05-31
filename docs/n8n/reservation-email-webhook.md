# Reservierungs-E-Mails (SMTP)

**Standard:** Gwada versendet E-Mails **direkt per SMTP** aus dem Server (`lib/email/send-via-smtp.ts`, nodemailer). Zugangsdaten verlassen den Server nicht.

Optional (legacy): n8n-Webhook — nur wenn du `N8N_RESERVATION_EMAIL_WEBHOOK_URL` setzt und den Code-Pfad wieder aktivierst.

---

## n8n (optional / legacy)

Gwada kann E-Mails alternativ über einen **Webhook** auf `https://automation.gwada.app` senden.

## Umgebungsvariablen (Next.js / Coolify)

```env
N8N_RESERVATION_EMAIL_WEBHOOK_URL=https://automation.gwada.app/webhook/gwada-reservation-email
N8N_WEBHOOK_SECRET=optional-gemeinsames-geheimnis
```

## Webhook-Request (POST, JSON)

Header (optional): `Authorization: Bearer <N8N_WEBHOOK_SECRET>`

```json
{
  "restaurantId": "uuid",
  "reservationId": "uuid",
  "to": "gast@example.com",
  "subject": "Deine Reservierung wurde bestätigt (#42)",
  "text": "Hallo …",
  "html": "<pre>…</pre>",
  "sender": {
    "mode": "default",
    "email": "contact@gwada.app",
    "name": "Gwada"
  },
  "smtp": {
    "email": "contact@gwada.app",
    "password": "…",
    "smtpHost": "smtp.example.com",
    "smtpPort": 587,
    "imapHost": "imap.example.com",
    "imapPort": 993
  },
  "meta": {
    "messageKind": "confirmed",
    "reservationNumber": 42
  }
}
```

- **`sender.mode`**: `"default"` → SMTP mit `contact@gwada.app` (Gwada-Standard)
- **`sender.mode`**: `"custom"` → SMTP mit Restaurant-Absender (`sender.email` / `sender.name` aus Integrationen)

## Workflow-Vorschlag (n8n)

1. **Webhook** (POST) empfängt Payload
2. **IF** `sender.mode === 'custom'` → SMTP-Node mit Restaurant-Credentials
3. **ELSE** → SMTP-Node mit Gwada-Standard (`contact@gwada.app`)
4. Im **Send Email (SMTP)**-Node:
   - **To:** `{{ $json.to }}`
   - **Subject:** `{{ $json.subject }}`
   - **HTML / Body:** `{{ $json.html }}` (Gwada liefert `html` immer mit; Plaintext zusätzlich als `text`)
   - **From:** `{{ $json.sender.email }}` bzw. Anzeigename `{{ $json.sender.name }}`
   - **SMTP:** Host/Port/User/Passwort aus `{{ $json.smtp }}` (Plattform-Fallback oder Restaurant-eigen)
5. Optional: Antwort `{ "ok": true }` bei Erfolg

## Auslöser in Gwada

- Sofort: Reservierung speichern (Status / Anlage), wenn `notify_email` aktiv
- Geplant: Cron `GET /api/cron/reservation-email` (Erinnerung / Danke)

Einstellungen: **Reservierungen → Einstellungen** (Texte) und **Einstellungen → Integrationen** (Absender).
