# Meta App Review Kit — Gwada (Facebook + Instagram)

**Stand:** August 2026 · **App:** Gwada (`https://gwada.app`)  
**Scope:** Nur **Facebook Page** + **Instagram Business** über Graph API v22.  
**Explizit ausgeschlossen:** WhatsApp, WAHA, WhatsApp Cloud API, WABA — in Texten, Videos und Testaccount **nicht** erwähnen / nicht verbinden.

Dieses Dokument ist zum **Kopieren in die Meta Developer Console** und für Screencasts gedacht.

---

## 0. Kurz: Was Meta sehen soll (und was nicht)

| Zeigen | Nicht zeigen |
|--------|----------------|
| Facebook Page verbinden | WhatsApp / WAHA / Superadmin-WAHA |
| Instagram Business verbinden | Nachrichten-Chip „WhatsApp“ |
| Messenger Inbox (Kontakte → Nachrichten) | Staff-Einladung per WhatsApp |
| Instagram DMs | News-Kanal WhatsApp-Channel |
| News: Post + Story (FB/IG) | Irgendein Hinweis auf Self-hosted WhatsApp |
| Galerie (FB/IG) | |
| Events (FB Event / IG Ankündigung) | |
| Bewertungen (Facebook) | |
| Insights (FB/IG) | |
| Datenschutz + Datenlöschung | |

**App-Kategorie in Meta:** Business · Restaurant / Hospitality SaaS  
**Login-Typ:** Kein „Login with Facebook“ für Gwada-User. Nur **Facebook Login Dialog** zum Verknüpfen der Restaurant-Page / IG Business.

---

## 1. Meta Developer Console — Checkliste (einmalig)

### 1.1 App-Einstellungen

| Feld | Wert |
|------|------|
| App Domains | `gwada.app` |
| Privacy Policy URL | `https://gwada.app/datenschutz` |
| Terms of Service URL | `https://gwada.app/agb` (falls vorhanden) bzw. Datenschutz + Impressum) |
| User Data Deletion | `https://gwada.app/datenloeschung` |
| Category | Business |
| App Icon | Gwada-Logo |

### 1.2 Facebook Login → Settings

| Feld | Wert |
|------|------|
| Valid OAuth Redirect URIs | `https://gwada.app/api/integrations/facebook/callback` |
| | `https://gwada.app/api/integrations/instagram/callback` |
| Client OAuth Login | Ja |
| Web OAuth Login | Ja |
| Enforce HTTPS | Ja |
| Embedded Browser OAuth | Optional nein |

### 1.3 Webhooks (Messenger / Instagram Messaging)

| Feld | Wert |
|------|------|
| Callback URL | `https://gwada.app/api/integrations/meta/webhook` |
| Verify Token | Wert aus Live-Env `META_WEBHOOK_VERIFY_TOKEN` |
| App Secret | Meta App Secret (auch in Gwada Superadmin → Integrationen Facebook/Instagram) |

Subscribe (Page): `messages`, `messaging_postbacks`, `message_deliveries`, `message_reads` (nur was ihr wirklich verarbeitet).

### 1.4 Produkte in der Meta-App aktivieren

- **Facebook Login**
- **Messenger** (für Page Inbox)
- **Instagram** (Instagram API with Instagram Login **oder** klassisch über Page — Gwada nutzt Page + `instagram_business_account`)
- **Webhooks**
- **Optional:** Insights / Pages API (über Permissions)

### 1.5 Was **nicht** anlegen / beantragen

- Kein **WhatsApp** Produkt
- Keine **WhatsApp Business Platform** Permissions
- Keine Erwähnung von WAHA in App-Beschreibung

---

## 2. Permissions beantragen (App Review)

In **App Review → Permissions and Features** genau diese Scopes anfordern (entspricht Code `FACEBOOK_OAUTH_SCOPES` / `INSTAGRAM_OAUTH_SCOPES`).

### 2.1 Facebook — Permission-Liste

| Permission | In Review beantragen? | Screencast nötig? |
|------------|----------------------|-------------------|
| `pages_show_list` | Ja | Ja (Connect-Flow) |
| `pages_messaging` | Ja | Ja (Inbox) |
| `pages_manage_metadata` | Ja | Ja (Connect + Webhook/Profil) |
| `pages_read_engagement` | Ja | Ja (News/Galerie lesen) |
| `pages_manage_posts` | Ja | Ja (Post/Story) |
| `pages_manage_engagement` | Ja | Ja (Review antworten / Kommentar) |
| `pages_read_user_content` | Ja | Ja (Gäste-Inhalte / Galerie) |
| `read_insights` | Ja | Ja (Insights) |

### 2.2 Instagram — Permission-Liste

| Permission | In Review beantragen? | Screencast nötig? |
|------------|----------------------|-------------------|
| `instagram_basic` | Ja | Ja |
| `instagram_manage_messages` | Ja | Ja (DMs) |
| `instagram_content_publish` | Ja | Ja (Post/Story) |
| `instagram_manage_comments` | Ja | Ja (optional kurz) |
| `instagram_manage_contents` | Ja | Ja (optional mit Publish) |
| `instagram_manage_insights` | Ja | Ja |
| `pages_show_list` | (bereits FB) | — |
| `pages_read_engagement` | (bereits FB) | — |
| `business_management` | Ja, falls Meta verlangt | Kurz: Business-Assets / Page-Auswahl |

---

## 3. Copy-Paste: App-Beschreibung (englisch, für Meta)

### 3.1 App purpose (kurz)

```text
Gwada is a restaurant operations platform for hospitality businesses in Germany/EU.
Restaurants connect their Facebook Page and Instagram Business account to manage
guest messaging (Messenger and Instagram Direct), publish posts and stories,
sync gallery content, manage Facebook events, respond to Facebook Page reviews,
and view Page/Instagram insights — all from one dashboard at https://gwada.app.

Facebook Login is used only to authorize access to the restaurant’s Facebook Page
and linked Instagram Business account. It is not used as the primary login for
Gwada user accounts (those use email/password or Google sign-in).
```

### 3.2 Detailed description

```text
Who uses the app:
Restaurant owners and managers who already have a Gwada workspace.

What the integration does:
1) Connect Facebook Page + Instagram Business under Settings → Integrations.
2) Read and reply to Facebook Messenger and Instagram Direct messages in Contacts → Messages.
3) Publish and schedule Facebook/Instagram posts and stories from the News module.
4) Import Facebook albums / Instagram tagged media into the Gallery module.
5) Create and update Facebook Events; optionally announce events on Instagram.
6) Fetch Facebook Page ratings and reply from the Reviews module.
7) Show Facebook Page and Instagram insights in the Insights module.
8) Optionally sync opening hours and reservation call-to-action to the Page/profile.

Data use:
Access tokens and Page/IG IDs are stored encrypted/server-side per restaurant
workspace. Data is used only to provide the features above for that restaurant.
Users can disconnect Meta in Settings. Account/data deletion instructions:
https://gwada.app/datenloeschung
Privacy policy: https://gwada.app/datenschutz
```

---

## 4. Copy-Paste: Permission Justifications (englisch)

Für jedes Permission-Feld in App Review **Use case** einfügen.

### `pages_show_list`

```text
We need pages_show_list so the restaurant owner can select which Facebook Page
belongs to their restaurant during OAuth. Gwada stores the chosen Page ID and
uses it for Messenger, posts, reviews, events, gallery and insights.
Without this permission the user cannot complete the connection flow.
```

### `pages_messaging`

```text
Restaurant staff answer guest questions in Facebook Messenger from Gwada
Contacts → Messages. We read conversations via the Page and send replies with
the Page access token so guests receive answers in Messenger.
This is core guest communication for hospitality businesses.
```

### `pages_manage_metadata`

```text
Required to subscribe the Page to webhooks and keep Page metadata (profile,
connection health) in sync so Messenger delivery and Page-linked features remain
reliable after connecting the Page in Gwada Settings → Integrations.
```

### `pages_read_engagement`

```text
Gwada reads the Page feed and engagement so restaurants can see published
content inside News and Gallery, and keep the dashboard consistent with what is
already live on Facebook.
```

### `pages_manage_posts`

```text
Restaurant managers create and schedule Facebook Page posts and photo/video
stories from Gwada News. Content is published to the connected Page using the
Page access token. This replaces posting only in native Meta apps.
```

### `pages_manage_engagement`

```text
Restaurants respond to Facebook Page recommendations/ratings and moderate
guest engagement from Gwada Reviews. Replies are posted back to Facebook so
guests see the response on the Page.
```

### `pages_read_user_content`

```text
Needed to read guest-generated content related to the Page (e.g. photos and
mentions) for Gallery/News sync so restaurants can manage guest content in one
place without leaving Gwada.
```

### `read_insights`

```text
Gwada Insights shows Facebook Page performance (reach, views, engagement) for
the connected restaurant Page so owners can measure marketing results without
opening Meta Business Suite.
```

### `instagram_basic`

```text
After connecting Instagram Business via the Facebook Page, we read the IG
business profile and media to show identity and content in Gwada News/Gallery.
```

### `instagram_manage_messages`

```text
Staff read and reply to Instagram Direct messages in Gwada Contacts → Messages
using the connected Instagram Business account, same inbox UX as Messenger.
```

### `instagram_content_publish`

```text
Managers publish Instagram feed posts and stories from Gwada News to the
connected Instagram Business account (image required for posts/stories).
```

### `instagram_manage_comments`

```text
Restaurants read and moderate Instagram comments on content published or synced
through Gwada to keep community management in one dashboard.
```

### `instagram_manage_contents`

```text
Allows managing Instagram content lifecycle for posts created or maintained via
Gwada (update/remove when the restaurant edits or deletes content in the app).
```

### `instagram_manage_insights`

```text
Gwada Insights displays Instagram Business account metrics (reach, interactions)
for the connected restaurant account.
```

### `business_management`

```text
Used when the restaurant’s Page/Instagram assets live under Meta Business
Manager. We need business_management to correctly list and attach the business
assets the owner is allowed to manage during the connect flow.
```

---

## 5. Testaccount — Gwada (für Meta Reviewer)

### 5.1 Credentials (vor Go-Live der Review ausfüllen)

| | Wert |
|--|------|
| App URL | `https://gwada.app` |
| Login | E-Mail / Passwort (kein Facebook-Login für Gwada) |
| E-Mail | `meta-review@gwada.app` |
| Passwort | `MetaReview-Gwada-2026!` |
| Restaurant | `Gwada Meta Review Demo` (slug `gwada-meta-review-demo`) |
| Rolle | Owner (kein Superadmin) |
| WhatsApp | UI ausgeblendet + Connect blockiert; keine WAHA-Session |

**Copy-Paste Block für Meta „Test credentials“:**

```text
Platform URL: https://gwada.app
Email: meta-review@gwada.app
Password: MetaReview-Gwada-2026!

Notes:
- Sign in with email/password (not Facebook Login).
- Open the demo restaurant workspace “Gwada Meta Review Demo”.
- Facebook Page and Instagram Business should be connected under Settings → Integrations.
- Do not look for WhatsApp; this demo does not use WhatsApp.
```

### 5.2 Testaccount anlegen — Checkliste (intern)

1. Provision: `pnpm provision:live:meta-review` oder GH Workflow `Provision Meta Review live`
2. Restaurant-Slug `gwada-meta-review-demo` — WhatsApp-Karte / Inbox-Chip / WAHA-API ausgeblendet bzw. blockiert
3. **Kein** Superadmin, **kein** WAHA
4. Billing: Pro complimentary
5. FB/IG mit Review-Page verbinden + Demo-Inhalte
6. Videos: nur Facebook/Instagram zeigen

### 5.3 Meta-Seite (Page + IG für Review)

| Item | Anforderung |
|------|-------------|
| Facebook Page | Eigene Demo-Page, Reviewer darf testen bzw. schon mit Gwada verbunden |
| Instagram | Business/Creator, mit der Page verknüpft |
| Meta App Roles | Reviewer ggf. als Tester; Page-Rollen korrekt |
| App Mode | Für Review: Permissions submitted; Development-Tester können vorab testen |

---

## 6. Erklärvideos / Screencasts — Drehbuch

Meta will meist **ein Video pro sensibler Permission** oder ein durchgängiges Video mit Timestamps.  
**Sprache:** Englisch sprechen oder englische Captions.  
**Länge:** 1–3 Min. pro Use-Case, klar, keine Schnitt-Tricks.

### Video A — Connect Facebook + Instagram (Scopes: `pages_show_list`, `pages_manage_metadata`, `business_management`, `instagram_basic`)

**Skript (EN, vorlesen):**

```text
This is Gwada, a restaurant dashboard.
I sign in with the provided test account.
I open Settings, then Integrations.
I click Connect Facebook.
I authorize Gwada for my Facebook Page.
I select the restaurant Page.
The Page is now connected.
I connect Instagram the same way — Instagram Business linked to that Page.
You can see Facebook and Instagram marked as connected.
We only use this to manage the restaurant Page and Instagram Business account.
```

**Kameraweg:** Login → Settings → Integrations → Connect → Meta Dialog → Page wählen → Connected Status.

### Video B — Messenger (`pages_messaging`)

```text
I open Contacts, then Messages.
I select the Facebook Messenger filter.
Here is an inbound guest message from Facebook Messenger.
I type a reply in Gwada and send it.
The reply is delivered to the guest in Messenger via the Page.
```

### Video C — Instagram Direct (`instagram_manage_messages`)

```text
Still in Messages, I switch to Instagram.
I open an Instagram Direct conversation.
I send a reply from Gwada.
The guest receives it in Instagram Direct.
```

### Video D — Publish Post + Story (`pages_manage_posts`, `pages_read_engagement`, `instagram_content_publish`, ggf. `instagram_manage_contents`)

```text
I open News.
I create a new post with an image for the restaurant.
I select Facebook and Instagram as publish targets.
I publish.
The post appears on the Facebook Page and Instagram feed.
Next I publish a Story to Facebook and Instagram from Gwada.
```

### Video E — Gallery (`pages_read_user_content`, `instagram_basic`, `pages_read_engagement`)

```text
I open Gallery.
Synced Facebook and Instagram media appear here.
Restaurants use this to manage guest and Page photos in one place.
```

### Video F — Reviews (`pages_manage_engagement`)

```text
I open Reviews, Facebook.
I open a Page recommendation/rating.
I write a reply and submit.
The reply is posted back to Facebook.
```

### Video G — Insights (`read_insights`, `instagram_manage_insights`)

```text
I open Insights.
Facebook Page metrics and Instagram metrics load from Meta for the connected accounts.
Owners use this to measure reach and engagement.
```

### Video H — Optional Events

```text
I open Events, create an event, publish to Facebook.
Optionally I post an Instagram announcement for the same event.
```

### Aufnahme-Tipps (WhatsApp-sicher)

- Vor Aufnahme: WhatsApp-Permission aus, Integration getrennt, Browser-Zoom so dass seitliche Nav keine WAHA-Badges zeigt.
- Nicht durch Superadmin → WAHA navigieren.
- Adresszeile gerne `gwada.app` zeigen.
- Wenn Nachrichten-UI Kanäle listet: nur Facebook + Instagram anklicken.

---

## 7. Notes for Reviewer (Copy-Paste, englisch)

```text
Thank you for reviewing Gwada.

Test login: see Test credentials field (email/password on https://gwada.app).

Recommended path:
1) Settings → Integrations — Facebook Page + Instagram Business already connected.
2) Contacts → Messages — reply on Messenger and Instagram Direct.
3) News — create/publish a post or story to Facebook/Instagram.
4) Gallery — view synced media.
5) Reviews → Facebook — reply to a recommendation.
6) Insights — view Page/IG metrics.

Important:
- Facebook Login is only used to connect Page/IG assets, not as Gwada account login.
- This demo does not include WhatsApp.
- Privacy: https://gwada.app/datenschutz
- Data deletion: https://gwada.app/datenloeschung

If a permission screen appears during reconnect, accept all requested Page/Instagram
permissions so messaging and publishing keep working.
```

---

## 8. Data use & deletion (Copy-Paste)

```text
Gwada stores Page/Instagram IDs, granted scopes and access tokens server-side per
restaurant workspace to call Meta Graph API for messaging, publishing, gallery,
events, reviews and insights.

Users can disconnect Facebook/Instagram under Settings → Integrations and revoke
the app under Facebook Settings → Apps and Websites.

Data deletion instructions for users and Meta App Review:
https://gwada.app/datenloeschung

Privacy policy:
https://gwada.app/datenschutz

Operator contact: contact@gwada.app
```

---

## 9. Interne Do’s / Don’ts vor Submit

### Do

- [ ] Live-App hat aktuelle FB/IG Connect-Callbacks auf `gwada.app`
- [ ] Superadmin: Facebook + Instagram Platform-Integration enabled, App ID/Secret gesetzt
- [ ] Webhook verifiziert
- [ ] Review-Restaurant **ohne** WhatsApp
- [ ] Screencasts hochgeladen, Timestamps in Permission-Notes
- [ ] Business Verification (falls Meta verlangt) vor Advanced Access

### Don’t

- [ ] WhatsApp-Produkt in Meta anlegen
- [ ] WAHA in Videos/Notes erwähnen
- [ ] Review-Account mit Produktions-WhatsApp verknüpfen
- [ ] „Login with Facebook“ als Gwada-Hauptlogin behaupten
- [ ] Permissions beantragen, die der Screencast nicht zeigt

---

## 10. Empfohlene Submit-Reihenfolge

1. Console-Basics (URLs, Login, Webhook) fertig  
2. Testaccount + Demo-Page/IG + Inhalte  
3. Screencasts drehen (A→G)  
4. Permissions + Justifications einfügen  
5. Test credentials + Reviewer notes  
6. Submit App Review  
7. Auf Rückfragen reagieren — immer nur FB/IG, nie WhatsApp

---

## 11. Mapping Code → Feature (für interne Nachweise)

| Permission | Gwada-Feature | Einstieg UI |
|------------|---------------|-------------|
| pages_* / IG scopes | OAuth | Einstellungen → Integrationen |
| pages_messaging / instagram_manage_messages | Inbox | Kontakte → Nachrichten |
| pages_manage_posts / instagram_content_publish | Posts/Stories | News |
| pages_read_* / instagram_basic | Feed/Medien | News, Galerie |
| pages_manage_engagement | Reviews reply | Bewertungen → Facebook |
| read_insights / instagram_manage_insights | Stats | Insights |
| pages_manage_metadata | Webhooks/Profil | Connect + Hintergrund |

Scope-Quelle im Code: `apps/web/lib/constants/integration-oauth-scopes.ts`

---

## 12. Offene Punkte (technisch, vor Review ideal)

1. **Data Deletion Callback:** Seite `/datenloeschung` existiert; automatischer Meta-Callback-Endpoint ggf. noch prüfen/ergänzen, falls Meta ihn zwingend testet.  
2. **Business Verification:** oft Voraussetzung für Advanced Access auf Messaging/Insights.  
3. **Testpasswort** und echte Demo-Page hier eintragen, bevor Submit.

---

---

## 13. Jedes Recht einzeln (perfekt zum Abhaken)

**Regel:** Pro Permission ein **eigenes kurzes Video** (30–90 Sek.) + den englischen Text ins Meta-Feld.  
WhatsApp in keinem Clip.

**Priorität**

| | Bedeutung |
|--|--|
| **P0** | Muss rein — Kernprodukt |
| **P1** | Soll rein — klar demonstrierbar |
| **P2** | Nur beantragen, wenn Screencast echt geht; sonst aus OAuth-Request streichen |

---

### FB-01 · `pages_show_list` · P0

| | |
|--|--|
| **DE** | Facebook-Seiten auswählen |
| **Wofür** | Restaurant wählt seine Page beim Connect |
| **UI** | Einstellungen → Integrationen → Facebook verbinden → Page wählen |
| **Video muss zeigen** | 1) Login Gwada 2) Connect klicken 3) Meta-Dialog mit Permission 4) Page-Liste 5) Page gewählt / Connected |
| **Justification (EN)** | |

```text
We need pages_show_list so restaurant owners can select which Facebook Page
belongs to their restaurant during OAuth in Gwada Settings → Integrations.
Gwada stores the chosen Page ID for Messenger, posts, reviews, events, gallery
and insights. Without this permission the connection flow cannot complete.
```

---

### FB-02 · `pages_manage_metadata` · P0

| | |
|--|--|
| **DE** | Seiten-Einstellungen & Webhooks |
| **Wofür** | Webhooks abonnieren, Page-Verbindung/Profil stabil halten |
| **UI** | Connect-Flow + danach Connected-Status; optional Öffnungszeiten-Sync |
| **Video muss zeigen** | Connect abschließen → Page connected → kurz zeigen, dass Messaging/Profil nutzbar ist (Webhook-Setup in Console darf im Text erwähnt werden) |
| **Justification (EN)** | |

```text
Required to subscribe the restaurant Facebook Page to webhooks and keep Page
metadata in sync after connecting in Gwada Settings → Integrations, so
Messenger delivery and Page-linked features remain reliable.
```

---

### FB-03 · `pages_messaging` · P0

| | |
|--|--|
| **DE** | Messenger-Nachrichten |
| **Wofür** | Messenger lesen + antworten |
| **UI** | Kontakte → Nachrichten → Filter Facebook |
| **Video muss zeigen** | Inbox öffnen → FB-Thread → eingehende Nachricht → Antwort senden → ideal: Zustellung in Messenger (Zweitgerät/Gast) |
| **Justification (EN)** | |

```text
Restaurant staff answer guest questions in Facebook Messenger from Gwada
Contacts → Messages. We read Page conversations and send replies with the Page
access token so guests receive answers in Messenger. This is core hospitality
guest communication.
```

---

### FB-04 · `pages_read_engagement` · P0

| | |
|--|--|
| **DE** | Beiträge & Seiten-Feed lesen |
| **Wofür** | Feed/Engagement für News & Galerie |
| **UI** | News (Facebook-Inhalte) und/oder Galerie |
| **Video muss zeigen** | Verbundene Page → News/Galerie öffnen → bestehende FB-Inhalte sichtbar |
| **Justification (EN)** | |

```text
Gwada reads the Facebook Page feed and engagement so restaurants can see
published content inside News and Gallery and keep the dashboard consistent
with what is already live on the Page.
```

---

### FB-05 · `pages_manage_posts` · P0

| | |
|--|--|
| **DE** | Beiträge veröffentlichen |
| **Wofür** | FB Posts + Stories aus News |
| **UI** | News → Beitrag erstellen → Kanal Facebook → Veröffentlichen / Story |
| **Video muss zeigen** | Bild+Text → Facebook wählen → Publish → Post (oder Story) auf der Page |
| **Justification (EN)** | |

```text
Restaurant managers create and schedule Facebook Page posts and photo/video
stories from Gwada News. Content is published to the connected Page with the
Page access token so teams do not need Meta Business Suite for routine posts.
```

---

### FB-06 · `pages_manage_engagement` · P0

| | |
|--|--|
| **DE** | Kommentare, Reaktionen & Bewertungen |
| **Wofür** | Facebook-Bewertungen beantworten |
| **UI** | Bewertungen → Facebook → Antwort schreiben → Senden |
| **Video muss zeigen** | Review öffnen → Reply tippen → absenden → Antwort auf Facebook sichtbar |
| **Justification (EN)** | |

```text
Restaurants respond to Facebook Page recommendations/ratings from Gwada
Reviews. Replies are posted back to Facebook so guests see the restaurant
response on the Page.
```

---

### FB-07 · `pages_read_user_content` · P1

| | |
|--|--|
| **DE** | Gäste-Inhalte auf der Seite |
| **Wofür** | Gäste-Fotos/Erwähnungen für Galerie/News |
| **UI** | Galerie (FB) / News-Sync |
| **Video muss zeigen** | Galerie öffnen → gast-/page-bezogene Medien aus Facebook |
| **Justification (EN)** | |

```text
Needed to read guest-generated content related to the Page (photos and
mentions) for Gallery/News sync so restaurants can manage guest content in
one place without leaving Gwada.
```

---

### FB-08 · `read_insights` · P0

| | |
|--|--|
| **DE** | Seiten-Statistiken & Insights |
| **Wofür** | Page Insights im Modul Insights |
| **UI** | Insights → Facebook |
| **Video muss zeigen** | Insights öffnen → Page-Kennzahlen laden (Reichweite/Aufrufe/Interaktion) |
| **Justification (EN)** | |

```text
Gwada Insights shows Facebook Page performance metrics (reach, views,
engagement) for the connected restaurant Page so owners can measure marketing
results without opening Meta Business Suite.
```

---

### IG-01 · `instagram_basic` · P0

| | |
|--|--|
| **DE** | Instagram-Profil & Medien |
| **Wofür** | IG Business Profil + Medien lesen |
| **UI** | Integrationen verbinden → News/Galerie Instagram |
| **Video muss zeigen** | IG verbunden → Profil/Medien in News oder Galerie |
| **Justification (EN)** | |

```text
After connecting Instagram Business via the Facebook Page, Gwada reads the
Instagram business profile and media to show identity and content in News and
Gallery.
```

---

### IG-02 · `instagram_manage_messages` · P0

| | |
|--|--|
| **DE** | Instagram Direct-Nachrichten |
| **Wofür** | IG DMs lesen + senden |
| **UI** | Kontakte → Nachrichten → Filter Instagram |
| **Video muss zeigen** | IG-Thread → Nachricht lesen → Reply senden |
| **Justification (EN)** | |

```text
Staff read and reply to Instagram Direct messages in Gwada Contacts → Messages
using the connected Instagram Business account, with the same inbox workflow
as Messenger.
```

---

### IG-03 · `instagram_content_publish` · P0

| | |
|--|--|
| **DE** | Instagram-Beiträge veröffentlichen |
| **Wofür** | IG Feed-Posts + Stories |
| **UI** | News → Beitrag mit Bild → Instagram → Publish / Story |
| **Video muss zeigen** | Bild zwingend → Instagram wählen → Publish → Beitrag/Story live |
| **Justification (EN)** | |

```text
Managers publish Instagram feed posts and stories from Gwada News to the
connected Instagram Business account. Image media is required for posts and
stories.
```

---

### IG-04 · `instagram_manage_insights` · P0

| | |
|--|--|
| **DE** | Instagram-Statistiken |
| **Wofür** | IG Insights |
| **UI** | Insights → Instagram |
| **Video muss zeigen** | Insights → IG-Metriken sichtbar |
| **Justification (EN)** | |

```text
Gwada Insights displays Instagram Business account metrics such as reach and
interactions for the connected restaurant account.
```

---

### IG-05 · `business_management` · P1

| | |
|--|--|
| **DE** | Meta Business Manager |
| **Wofür** | Business-Assets/Page korrekt zuordnen beim Connect |
| **UI** | Connect-Flow (Page/IG aus Business) |
| **Video muss zeigen** | Connect → Assets/Pages aus Business-Kontext wählbar → verbunden |
| **Justification (EN)** | |

```text
Used when the restaurant’s Page and Instagram assets live under Meta Business
Manager. business_management lets Gwada list and attach the business assets
the owner is allowed to manage during the connect flow.
```

---

### IG-06 · `instagram_manage_comments` · P2 ⚠️

| | |
|--|--|
| **DE** | Instagram-Kommentare |
| **Status** | Im OAuth-Katalog angefragt; **eigene Moderations-UI schwach belegt** |
| **Empfehlung** | Nur beantragen, wenn ihr Kommentare lesen/antworten im Screencast zeigt. Sonst **vor Submit aus Scope-Liste nehmen**, sonst Rejection-Risiko. |
| **Falls doch** | Video: IG-Kommentar in Gwada öffnen → antworten/moderieren |
| **Justification (EN)** | |

```text
Restaurants read and moderate Instagram comments on content published or
synced through Gwada so community management stays in one dashboard.
```

---

### IG-07 · `instagram_manage_contents` · P2 ⚠️

| | |
|--|--|
| **DE** | Instagram-Inhalte verwalten |
| **Status** | Katalog-Scope; Publish deckt der Screencast oft schon über `instagram_content_publish` |
| **Empfehlung** | Nur beantragen mit klarem Edit/Delete-Flow. Sonst weglassen. |
| **Falls doch** | Video: veröffentlichten IG-Inhalt in Gwada bearbeiten oder entfernen |
| **Justification (EN)** | |

```text
Allows managing the Instagram content lifecycle for posts created via Gwada
(update or remove when the restaurant edits or deletes content in the app).
```

---

## 14. Aufnahme-Reihenfolge (empfohlen)

| # | Dateiname (Vorschlag) | Permissions abdecken |
|---|----------------------|----------------------|
| 1 | `01-pages_show_list.mp4` | `pages_show_list` |
| 2 | `02-pages_manage_metadata.mp4` | `pages_manage_metadata` (+ kurz Connected) |
| 3 | `03-pages_messaging.mp4` | `pages_messaging` |
| 4 | `04-instagram_manage_messages.mp4` | `instagram_manage_messages` |
| 5 | `05-pages_manage_posts.mp4` | `pages_manage_posts` |
| 6 | `06-instagram_content_publish.mp4` | `instagram_content_publish` |
| 7 | `07-pages_read_engagement.mp4` | `pages_read_engagement` |
| 8 | `08-pages_read_user_content.mp4` | `pages_read_user_content` |
| 9 | `09-instagram_basic.mp4` | `instagram_basic` |
| 10 | `10-pages_manage_engagement.mp4` | `pages_manage_engagement` |
| 11 | `11-read_insights.mp4` | `read_insights` |
| 12 | `12-instagram_manage_insights.mp4` | `instagram_manage_insights` |
| 13 | `13-business_management.mp4` | `business_management` |
| — | optional | `instagram_manage_comments`, `instagram_manage_contents` |

**Hinweis:** `pages_show_list` / `pages_read_engagement` stehen auch in der Instagram-OAuth-Liste — in Meta oft nur **einmal** beantragen; Screencast trotzdem der jeweiligen Nutzung zuordnen.

---

## 15. Minimal-Set (wenn Review schlank bleiben soll)

Nur diese **12** mit Video beantragen:

1. `pages_show_list`  
2. `pages_manage_metadata`  
3. `pages_messaging`  
4. `pages_read_engagement`  
5. `pages_manage_posts`  
6. `pages_manage_engagement`  
7. `pages_read_user_content`  
8. `read_insights`  
9. `instagram_basic`  
10. `instagram_manage_messages`  
11. `instagram_content_publish`  
12. `instagram_manage_insights`  

Dazu optional `business_management`, wenn Connect ohne ihn scheitert.  
**Weglassen bis UI klar:** `instagram_manage_comments`, `instagram_manage_contents`.

---

*Ende Kit — bei Änderungen an Scopes in `integration-oauth-scopes.ts` dieses Dokument mitziehen.*
