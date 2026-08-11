# POS Kellner-Portemonnaie + Schichtübergabe — Design

**Datum:** 2026-08-11  
**Status:** Approved (Produkt) · Spec zur Review  
**Ansatz:** Börse als Unterbuch der Restaurant-Kasse (Ansatz 1)  
**Branch-Kontext:** `apps/pos` · Roadmap: Storno → Seat → Merge → **Handover + Cash Bag** → Move LAN (Move erledigt)  
**Bezug:** `pos_register_sessions` (Anfangs-/Endbestand, Z/Fiskaly), `pos_table_sessions.owner_profile_id`, Nest `POST /v1/shifts/transfer`, PIN/`transfer`-Capability, Bar-Kassierung (`collectCash`)

## Problem

Kellner sollen mit einem **persönlichen Portemonnaie** arbeiten: Wechselgeld aus der Ladenkasse, danach füllt sich der Beutel mit **Bar-Kassierungen**. Schichtübergabe soll Tische (und optional die Börse) übergeben können. Schichtende braucht **Pflichtzählung** mit dokumentierter Differenz — finanzamtkonform und Lightspeed-nah (Server Banking), ohne pro Kellner eine eigene TSE-Kasse.

Heute: eine **restaurantweite** Kassensitzung; Bargeld-Zahlungen ohne Waiter-Zuordnung; Übergabe nur Tisch-Owner.

## Ziele

1. Eine fiskalische **Restaurant-Kasse** bleibt SoT für TSE/Z-Bon (bestehend).
2. Darunter: **Kellner-Börse** mit Startguthaben aus der Kasse (Ausgabe Wechselgeld).
3. Bar-Kassierung erhöht das Soll der Börse des **Kassierers** (PIN am Gerät).
4. Schichtübergabe: **Default nur Tische**; optional **mit Börse**.
5. Schichtende: **Pflicht Ist vs. Soll**; bei |Differenz| ≥ Schwelle **Manager-PIN**.
6. Append-only Bewegungsjournal für Prüfung/Haftung.
7. Hub-SoT + Sync analog anderer POS-Mutationen; Offline ohne Hub blockieren.

## Nicht-Ziele (v1)

| Thema | Umgang |
|-------|--------|
| Eigene TSE / Register pro Kellner | Nein |
| Soft-Tracking ohne Kassenausgabe | Nein (widerspricht Variante A) |
| Tip-Pool / Tip-out | Nein |
| Mehrere parallele Börsen pro Person | Nein |
| Hardware-Schubladen-Kick | Separat |
| Mid-shift Drop UI | Datenmodell vorsehen; UI **v1.1** |
| Owner-Badge stark am Floor | v1.1 / Layout-P2 |

## Entscheidungen (bestätigt)

| # | Thema | Wahl |
|---|--------|------|
| 1 | Wechselgeld-Quelle | **A** — physisch/gebucht aus Restaurant-Kasse → Börse |
| 2 | Bar-Zuordnung | **A** — Portemonnaie des **Kassierers** (PIN) |
| 3 | Schichtübergabe | **C** — Default Tische; optional Checkbox „mit Börse“ |
| 4 | Schichtende | **A** — Pflichtzählung + **Manager-PIN** bei großer Differenz |
| 5 | Architektur | **Ansatz 1** — Börse = Unterbuch der Register-Session |
| 6 | Kassieren ohne Börse | **Blockieren** bis Wechselgeld/Börse offen |
| 7 | Diff-Schwelle Default | **500 Cent (5,00 €)**, restaurant-konfigurierbar |
| 8 | Übergabe mit Börse | Empfänger übernimmt **System-Soll** (kein Diff-Zwang); Journal `handover` |

## Begriffe

| Begriff | Bedeutung |
|---------|-----------|
| **Restaurant-Kasse** | Offene `pos_register_sessions`-Zeile; Z-Abschluss / DSFinV-K |
| **Kellner-Börse / Portemonnaie** | Offene Bargeld-Haftung eines Kellners innerhalb der Register-Session |
| **Startguthaben / Wechselgeld** | `float_out`: Kasse → Börse |
| **Soll** | Start + Bar-Kassierungen − Drops (± Handover-Fortführung) |
| **Ist** | Gezählter Bestand beim Schließen |
| **Differenz** | Ist − Soll (Über/Unter) |
| **Drop** | Börse → Kasse/Safe (`drop_in` auf Kasse) — Modell v1, UI v1.1 |
| **Schichtübergabe** | Owner-Transfer der Tische; optional Börsen-Übernahme |

## Objekte / Datenmodell (logisch)

### `waiter_cash_bag` (Arbeitstitel)

- `id`, `restaurant_id`, `register_session_id`, `staff_profile_id`
- `status`: `open` \| `handed_over` \| `closed`
- `opening_float_cents`, `expected_cents` (oder berechnet), `closing_count_cents`, `difference_cents`
- `opened_at` / `closed_at`, `opened_by`, `closed_by`, `manager_override_profile_id` (bei Diff)
- Unique: max. **eine** `open`-Börse pro `(restaurant_id, staff_profile_id)`

### `waiter_cash_bag_movement` (append-only)

| `kind` | Wirkung |
|--------|---------|
| `float_out` | Kasse −X, Börse +X (Startguthaben) |
| `cash_sale` | Börse +X (Referenz Payment/Settlement-Id) |
| `drop_in` | Börse −X, Kasse +X (v1.1 UI) |
| `handover` | Abgeber schließen als `handed_over`; Empfänger-Börse fortführen / neu mit gleichem Soll |
| `close_count` | Ist erfassen, Diff speichern, Status `closed` |

Storno nur als **Gegenbuchung**, nie Delete/Update der Historie.

### Anbindung Register / Payments

- Börse **immer** an `register_session_id` der offenen Kasse.
- `pos_payments` (cash): zusätzlich `cashier_profile_id` + optional `cash_bag_id` (oder nur über Movement-Referenz) — damit Z-Fenster und Börse konsistent bleiben.
- Restaurant-Kassen-Soll für Z-Bon: weiterhin Register-Zeitfenster; Wechselgeld-Ausgaben und Drops müssen im **Kassenbuch / expected cash** der Register-Session berücksichtigt werden (Opening + Sales − Float-outs + Drops … — Implementierungsdetail im Plan).

## Caps / Auth

- Kasse öffnen/schließen: bestehende `pos.kasse.*`
- Wechselgeld ausgeben: Manager oder Cap z. B. `cash_bag.issue` / Wiederverwendung `cash_count` + kasse
- Kassieren: Staff-PIN; offene eigene Börse Pflicht
- Transfer Tische: Capability `transfer` (bestehend)
- Transfer mit Börse: `transfer` + beide PINs; Empfänger übernimmt Haftung
- Close mit |Diff| ≥ Schwelle: Manager-PIN
- LAN/Hub: Staff-Proof wie Void/Collect; Solo-DEBUG analog Policy

## UI-Einstiege

| Ort | Aktion |
|-----|--------|
| Hub Mehr → Kasse | Register open/close; offene Börsen; **Wechselgeld ausgeben** |
| Handheld Mehr / Schicht | Soll anzeigen; **Schicht beenden** |
| Session-Menü | **Schichtübergabe** + Checkbox „mit Börse“ |
| Kassieren | Blocker ohne offene Börse |
| Floor | Owner-Badge später (v1.1) |

## Regeln (kurz)

- Eine offene Börse pro Kellner; nur bei offener Restaurant-Kasse.
- Nur **Bar** in die Börse; Karte/Sonstige nicht.
- Journal append-only.
- Börsen-Mutationen nur mit erreichbarer Kasse (Hub) bzw. Solo lokal+Sync wie Floor-Mutationen.
- Warnung am Register-Close, wenn noch offene Börsen existieren (idealerweise blockieren oder Manager-Override — **Empfehlung: Warnung + Bestätigung**, Block optional per Setting; Default Warnung+Confirm).

## Fehlerfälle

| Fall | Verhalten |
|------|-----------|
| Kassieren ohne Börse | Block + Hinweis Wechselgeld |
| Zweite Börse öffnen | Reject |
| Register geschlossen | Keine float_out / cash_sale auf Börse |
| Übergabe mit Börse, Empfänger hat schon offene Börse | Reject oder erzwungenes Close vorher — **Reject** |
| Diff ≥ Schwelle ohne Manager | Reject close |
| Hub offline (Handheld) | Wie andere Live-Floor-Ops: blockieren |

## Testfokus (Acceptance)

1. Register open → float 100 € an Kellner A → Börse Soll 100.
2. A kassiert 50 € Bar → Soll 150; Movement `cash_sale`.
3. Übergabe nur Tische → Owner wechselt, Börse bleibt A.
4. Übergabe mit Börse → A `handed_over`, B führt Soll fort.
5. Close mit Ist = Soll → Diff 0, closed.
6. Close mit Diff 6 € → Manager-PIN nötig, Diff gespeichert.
7. Kassieren ohne Börse → blocked.
8. UITest/Unit für Journal-Unveränderlichkeit und Unique-open-bag.

---

## Anleitung: Von Anfang bis Ende

### Wer macht was?

| Rolle | Aufgaben |
|-------|----------|
| **Manager / Kasse** | Restaurant-Kasse öffnen & schließen; Wechselgeld ausgeben; Manager-PIN bei großer Börsen-Differenz |
| **Kellner** | Mit Börse arbeiten; bar kassieren; optional Übergabe; am Ende zählen und Börse schließen |
| **Empfänger (Übergabe)** | PIN bestätigen; bei „mit Börse“ Haftung für Soll übernehmen |

### Schritt 1 — Restaurant-Kasse öffnen

1. Am **Hub (iPad)** zu **Mehr → Kasse** (oder bestehendem Kassen-Screen).
2. **Kasse öffnen**, Anfangsbestand der **Ladenkasse** eingeben (Münzen/Scheine in der Schublade/Safe — nicht die Kellnerbörsen).
3. Erst danach sind Bar-Kassierungen und Wechselgeld-Ausgaben erlaubt.

### Schritt 2 — Kellner bekommt Startguthaben (Portemonnaie)

1. Kellner meldet sich am Handheld mit PIN an.
2. Manager wählt am Hub: **Wechselgeld ausgeben** → Kellner → Betrag (z. B. **100,00 €**).
3. Physisch: 100 € Wechselgeld aus der Ladenkasse an den Kellner.
4. App bucht: Ladenkasse −100 € (`float_out`), Börse des Kellners **offen** mit Soll 100 €.
5. Am Handheld sieht der Kellner: Portemonnaie offen, Soll 100,00 €.

### Schritt 3 — Während der Schicht

1. Bestellen, feuern, Tische bedienen wie bisher.
2. Beim **Bar-Kassieren** bestätigt der Kellner mit PIN → Betrag erhöht **sein** Portemonnaie-Soll.
3. Kartenzahlungen erscheinen **nicht** in der Börse.
4. Tisch-Owner (Floor) und Börsen-Inhaber können auseinanderlaufen, wenn jemand fremde Tische kassiert — gewollt (Kassierer = Haftung Bargeld).

### Schritt 4 — Schichtübergabe (mittendrin)

1. Abgeber öffnet am Tisch oder unter Schicht: **Schichtübergabe**.
2. Empfänger gibt PIN ein (4-Augen).
3. **Standard (ohne Haken):** Nur Tisch-Owner(s) wechseln. Portemonnaie bleibt beim Abgeber; der schließt die Börse später selbst.
4. **Mit Haken „mit Börse“:**  
   - App zeigt aktuelles Soll.  
   - Empfänger bestätigt Übernahme (kein Pflicht-Zählen).  
   - Abgeber-Börse → `handed_over`.  
   - Empfänger führt Börse mit gleichem Soll weiter (Journal `handover`).  
5. Danach kassiert der Empfänger bar in **seine** (übernommene) Börse.

### Schritt 5 — Schichtende Kellner (Börse schließen)

1. Kellner: **Schicht beenden** / Börse schließen.
2. App zeigt **Soll** (Start + Bar − Drops).
3. Kellner zählt physisch und gibt **Ist** ein.
4. Differenz = Ist − Soll wird angezeigt.  
   - |Diff| &lt; Schwelle (Default 5 €): Bestätigung reicht.  
   - |Diff| ≥ Schwelle: **Manager-PIN** erforderlich.
5. Börse → `closed`; Bargeld zurück an Ladenkasse/Safe (physisch). Optional später Buchung als Drop beim Close.
6. Ohne geschlossene Börse: Abmelden kann gewarnt/blockiert werden (Empfehlung: starke Warnung).

### Schritt 6 — Tagesende Restaurant

1. Manager prüft: möglichst **alle Börsen geschlossen** (Liste am Kassen-Screen).
2. Wenn noch offen: Warnung; nach Bestätigung oder nach Schließen aller Börsen weiter.
3. Manager schließt **Restaurant-Kasse** mit gezähltem Ladenkassen-Endbestand → Z-Bon / Fiskaly / Accounting wie heute.
4. Börsenjournale bleiben für Nachweise an der Register-Session hängen.

### Kurz-Checkliste Schicht

```
[ ] Kasse öffnen (Manager)
[ ] Wechselgeld an Kellner ausgeben
[ ] Bedienen + bar kassieren
[ ] Bei Wechsel: Übergabe (± Börse)
[ ] Kellner: zählen & Börse schließen (+ Manager bei Diff)
[ ] Kasse schließen / Z-Bon (Manager)
```

---

## Spec-Selbstcheck

- Keine TBDs zu Kernentscheidungen; Drop-UI klar v1.1.
- Register-Close bei offenen Börsen: Default Warnung+Confirm (explizit).
- Scope: ein Slice „Cash Bag + Handover UX“; Z-Formel-Anpassung Register als Plan-Task.
- Kassierer vs. Owner: eindeutig Kassierer für Bargeld.
