# Bestellungen (PO): Daten prüfen & wiederherstellen

**Kontext:** Vollständiger technischer Audit in `docs/audit-stale-client-overwrite-pattern.md`.  
**Fix ab:** PR `#462` / `#464` bzw. Branch `cursor/fix-po-overwrite-hardening-dd85` (Merge-before-save, Fetch-Gate, Cache-Patch nach Save).  
**Daten-Recovery:** `scripts/recover-zurschlag-purchase-orders.ts` — **erst nach Live-Deploy des Fixes** ausführen.

---

## Symptome (typisch nach Deploy oder mehreren Tabs)

- Abgeschlossene Bestellungen erscheinen wieder als **Offen** oder **Bestellt**
- Positionen oder ganze Bestellungen **fehlen**
- Mengen stimmen nicht mit dem überein, was das Team zuletzt eingegeben hat
- Betroffenes Restaurant (Beispiel): **Zur Schlagd** — Slug `zurschlagd`, UUID typisch `fcc50bb3-130d-476b-94dc-3c7392b773a8`

---

## 1. In Supabase prüfen (SQL)

Im Supabase Studio (Dev oder Live) für die `restaurant_id` des Betriebs:

```sql
-- Status-Übersicht
SELECT id, supplier_name, status, created_at, delivery_date
FROM inventory_purchase_orders
WHERE restaurant_id = '<RESTAURANT_UUID>'
ORDER BY created_at DESC;

-- Verdächtig: closed mit wenig Log vs. ordered mit viel Log
SELECT o.id, o.supplier_name, o.status,
       (SELECT count(*) FROM inventory_purchase_order_log l WHERE l.order_id = o.id) AS log_count,
       (SELECT count(*) FROM inventory_purchase_order_lines ln WHERE ln.order_id = o.id) AS line_count
FROM inventory_purchase_orders o
WHERE o.restaurant_id = '<RESTAURANT_UUID>'
ORDER BY o.created_at DESC;
```

```sql
-- Letzte Status-Wechsel im Protokoll
SELECT l.order_id, o.supplier_name, l.kind, l.from_status, l.to_status, l.at
FROM inventory_purchase_order_log l
JOIN inventory_purchase_orders o ON o.id = l.order_id
WHERE o.restaurant_id = '<RESTAURANT_UUID>'
  AND l.kind = 'status_change'
ORDER BY l.at DESC
LIMIT 50;
```

**Hinweis:** Wenn `status = 'open'` aber im Log ein Wechsel zu `closed` fehlt (oder umgekehrt), wurde vermutlich ein veralteter Client-Snapshot per Full-Replace geschrieben.

---

## 2. Automatische Recovery (Zurschlag / wenn Protokoll noch `closed` + `marked_delivered` enthält)

**Reihenfolge:** App-Fix live deployen → **danach** Recovery (sonst kann ein alter Tab erneut überschreiben).

### Dev prüfen (Dry-Run)

```bash
pnpm recover:po:zurschlag
# oder explizit:
dotenv -e .env.development -- pnpm exec tsx scripts/recover-zurschlag-purchase-orders.ts
```

### Live anwenden

GitHub Action (empfohlen): **Recover zurschlagd purchase orders live** — erst ohne Häkchen (Diagnose + Dry-Run), dann mit **Apply recovery**.

Oder lokal mit Production-Env:

```bash
GWADA_CONFIRM_LIVE_PO_RECOVERY=1 dotenv -e .env.production -- \
  pnpm exec tsx scripts/recover-zurschlag-purchase-orders.ts --apply
```

Das Skript ist **idempotent**: es setzt nur Zeilen zurück, bei denen `status` oder Lieferfelder **unter** dem Protokoll-Stand liegen (z. B. DB `open`, Log enthält `status_change → closed`).

**Wenn das Protokoll mit überschrieben wurde** (kein `closed` / `marked_delivered` mehr im Log): automatische Recovery greift nicht → Abschnitt 3 (manuell).

Read-only Diagnose auf Live:

```bash
bash scripts/run-live-sql-ci.sh scripts/diagnose-zurschlagd-purchase-orders-live.sql
```

---

## 3. Manuelle Korrektur in der App

Falls Recovery nichts findet oder Positionen fehlen:

1. **Alle Tabs schließen** — nur **ein** Browser-Tab pro Gerät für Bestand/Bestellungen
2. Seite **hart neu laden** (Strg/Cmd+Shift+R), kurz warten bis die Liste vollständig geladen ist
3. Betroffene Bestellungen prüfen:
   - Falsch **offen** → erneut **Bestellt** markieren, Lieferungen erfassen, **Abschließen**
   - Fehlende **Positionen** → Mengen neu eintragen (Offene Bestellung des Lieferanten nutzen oder neu anlegen)
   - Falsche **Mengen** → in der Zeile korrigieren und speichern

---

## 4. Backup / Point-in-Time Recovery (VPS Supabase)

Wenn viele Bestellungen betroffen sind:

| Option | Vorgehen |
|--------|----------|
| **Supabase PITR** (falls auf dem VPS aktiviert) | Im Supabase-Dashboard bzw. über den Hosting-Anbieter einen Zeitpunkt **vor** dem Vorfall wählen; nur betroffene Tabellen (`inventory_purchase_orders`, `_lines`, `_log`) selektiv zurückspielen — **nicht** blind `db reset` auf Production |
| **Manuelles pg_dump / Snapshot** | Falls tägliche Backups existieren: Dump vom Vortag einspielen in eine **temporäre** DB, fehlende Zeilen per SQL exportieren und in Live **einfügen** (mit Vorsicht, IDs beibehalten) |
| **Kein Backup** | Nur manuelle Nachpflege in der App (Abschnitt 2) |

Vor jeder Wiederherstellung: **Dev-Kopie** testen oder SQL in einer Transaktion mit Rollback-Möglichkeit.

---

## 5. Bis der Fix live ist (Zurschlag / Team)

| Do | Don't |
|----|-------|
| Nach jedem **Deploy** alle Bestell-Tabs **neu laden** | Mehrere Tabs gleichzeitig Bestellungen bearbeiten |
| **Ein Tab** pro Person für Bestand/Bestellungen | Seite offen lassen, deployen, dann ohne Reload weiterklicken |
| Nach Reload **2–3 Sekunden** warten, bis die Liste steht | Sofort nach Reload Status ändern, wenn die Liste noch „springt“ |
| Bei Auffälligkeiten **sofort** Screenshots + Uhrzeit notieren | Verdächtige Daten nochmal „durchklicken“ in der Hoffnung, es richtet sich von selbst |

---

### Kurztext fürs Team / Gäste (temporär falsche Bestellliste)

> „Bei uns sind zwei Lieferanten-Bestellungen nach dem heutigen Update kurz wieder als ‚offen‘ sichtbar — die Lieferungen waren erledigt. Wir stellen das gerade in der Verwaltung zurück; in Kürze stimmt die Liste wieder. Bestellungen beim Gast sind davon nicht betroffen.“

---

## 6. Nach Live-Deploy + Recovery prüfen

| Schritt | Befehl / Aktion |
|--------|------------------|
| App-Version | `curl -s https://gwada.app/api/build-info` — `sha` = Commit mit PO-Hardening |
| DB-Diagnose | Workflow **Recover zurschlagd purchase orders live** (Dry-Run) oder `diagnose-zurschlagd-purchase-orders-live.sql` |
| Recovery | Gleicher Workflow mit **Apply**, oder Skript mit `--apply` |
| UI | Bestand → Bestellungen: **2** betroffene Bestellungen = **Abgeschlossen**, Positionen mit Liefer-Antwort |
| Kein Re-Overwrite | Nur **ein Tab**, Seite nach Deploy **neu laden** |

---

## 7. Verwandte Module

- **Zutaten-Bestand** (`inventory_replace_ingredients`): gleiches Risiko bei Display/POS/Rechnung — Bestand physisch zählen und im Modul korrigieren
- **Unread-Glocke nach Deploy:** separates Problem (Read-State), kein PO-Datenverlust — siehe Audit-Dokument

---

## Referenzen

- Technischer Audit: `docs/audit-stale-client-overwrite-pattern.md`
- Workspace-Regel: `.cursor/rules/no-stale-client-overwrite.mdc`
- Merge-Logik: `apps/web/lib/inventory/merge-purchase-orders-for-replace.ts`
