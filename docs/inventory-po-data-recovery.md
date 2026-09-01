# Bestellungen (PO): Daten prüfen & manuell wiederherstellen

**Kontext:** Vollständiger technischer Audit in `docs/audit-stale-client-overwrite-pattern.md`.  
**Fix ab:** Branch/PR `cursor/fix-po-overwrite-hardening-dd85` (Merge-before-save, Fetch-Gate, Cache-Patch nach Save).

---

## Symptome (typisch nach Deploy oder mehreren Tabs)

- Abgeschlossene Bestellungen erscheinen wieder als **Offen** oder **Bestellt**
- Positionen oder ganze Bestellungen **fehlen**
- Mengen stimmen nicht mit dem überein, was das Team zuletzt eingegeben hat
- Betroffenes Restaurant (Beispiel): **Zurschlag**

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

## 2. Manuelle Korrektur in der App

Nach dem **Live-Deploy des Fixes**:

1. **Alle Tabs schließen** — nur **ein** Browser-Tab pro Gerät für Bestand/Bestellungen
2. Seite **hart neu laden** (Strg/Cmd+Shift+R), kurz warten bis die Liste vollständig geladen ist
3. Betroffene Bestellungen prüfen:
   - Falsch **offen** → erneut **Bestellt** markieren, Lieferungen erfassen, **Abschließen**
   - Fehlende **Positionen** → Mengen neu eintragen (Offene Bestellung des Lieferanten nutzen oder neu anlegen)
   - Falsche **Mengen** → in der Zeile korrigieren und speichern

Es gibt **keinen** automatischen „Repair“-Button in der App.

---

## 3. Backup / Point-in-Time Recovery (VPS Supabase)

Wenn viele Bestellungen betroffen sind:

| Option | Vorgehen |
|--------|----------|
| **Supabase PITR** (falls auf dem VPS aktiviert) | Im Supabase-Dashboard bzw. über den Hosting-Anbieter einen Zeitpunkt **vor** dem Vorfall wählen; nur betroffene Tabellen (`inventory_purchase_orders`, `_lines`, `_log`) selektiv zurückspielen — **nicht** blind `db reset` auf Production |
| **Manuelles pg_dump / Snapshot** | Falls tägliche Backups existieren: Dump vom Vortag einspielen in eine **temporäre** DB, fehlende Zeilen per SQL exportieren und in Live **einfügen** (mit Vorsicht, IDs beibehalten) |
| **Kein Backup** | Nur manuelle Nachpflege in der App (Abschnitt 2) |

Vor jeder Wiederherstellung: **Dev-Kopie** testen oder SQL in einer Transaktion mit Rollback-Möglichkeit.

---

## 4. Bis der Fix live ist (Zurschlag / Team)

| Do | Don't |
|----|-------|
| Nach jedem **Deploy** alle Bestell-Tabs **neu laden** | Mehrere Tabs gleichzeitig Bestellungen bearbeiten |
| **Ein Tab** pro Person für Bestand/Bestellungen | Seite offen lassen, deployen, dann ohne Reload weiterklicken |
| Nach Reload **2–3 Sekunden** warten, bis die Liste steht | Sofort nach Reload Status ändern, wenn die Liste noch „springt“ |
| Bei Auffälligkeiten **sofort** Screenshots + Uhrzeit notieren | Verdächtige Daten nochmal „durchklicken“ in der Hoffnung, es richtet sich von selbst |

---

## 5. Verwandte Module

- **Zutaten-Bestand** (`inventory_replace_ingredients`): gleiches Risiko bei Display/POS/Rechnung — Bestand physisch zählen und im Modul korrigieren
- **Unread-Glocke nach Deploy:** separates Problem (Read-State), kein PO-Datenverlust — siehe Audit-Dokument

---

## Referenzen

- Technischer Audit: `docs/audit-stale-client-overwrite-pattern.md`
- Workspace-Regel: `.cursor/rules/no-stale-client-overwrite.mdc`
- Merge-Logik: `apps/web/lib/inventory/merge-purchase-orders-for-replace.ts`
