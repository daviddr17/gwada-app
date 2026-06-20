# Mitarbeiter: ToDo-Listen

Stand: 2026-06-20 · Phasenplan für Modul **ToDo-Listen** unter Mitarbeiter.

## Ziel

Zentrale ToDos für das Restaurant — verwaltet im Dashboard, sichtbar im **Profil**, auf dem **Display** (Badge + Schicht-Popup) und nachvollziehbar im **Protokoll**. Benachrichtigungen in der Glocke bei **Erledigen** und **Verschieben**.

---

## Navigation

| Route | Inhalt |
|-------|--------|
| `/dashboard/mitarbeiter/todos` | Listen, Filter, Anlegen/Bearbeiten |
| `/dashboard/mitarbeiter/todos/protokoll` | Audit-Log (filterbar) |
| `/dashboard/mitarbeiter/todos?staff=<uuid>` | Nur ToDos für diesen Mitarbeiter |
| `/dashboard/mitarbeiter/todos/einstellungen` | Restaurant-Defaults (später P1+) |

**Modul-Chip:** „ToDo-Listen“ in `STAFF_NAV` (Mitarbeiter-Layout).

**Unter-Chips** (ToDo-Layout): „Liste“ · „Protokoll“.

**Profil:** Abschnitt im `StaffFormDrawer` + Link zur gefilterten Liste.

---

## Berechtigungen (Rollen)

Prefix **`staff_todos`** — CRUD in Rollen-UI:

| Key | Bedeutung |
|-----|-----------|
| `staff_todos.read` | Listen, Protokoll, Profil-Abschnitt |
| `staff_todos.create` | Anlegen |
| `staff_todos.update` | Bearbeiten, fremd erledigen, Snooze zurücksetzen |
| `staff_todos.delete` | Archivieren/löschen |

Legacy: `staff.manage` impliziert volle ToDo-Rechte (via `auth_has_restaurant_permission`).

**Display-Aktionen:** Betroffener Mitarbeiter immer für eigene ToDos; Positions-ToDos auch für Kollegen derselben **Position-Tag**-Gruppe; Dashboard-Aktionen zusätzlich mit `staff_todos.update`.

---

## Zuordnung

| Typ | Feld | Sichtbar für |
|-----|------|--------------|
| Einzelperson | `assignee_type = staff`, `staff_id` | Dieser Mitarbeiter |
| Positionsgruppe | `assignee_type = position_tag`, `position_tag_id` | Alle aktiven MA mit diesem **Position-Tag** |

**Erledigungsmodus** (`completion_mode`):

- `any_one` — einer reicht, global erledigt
- `each_assignee` — jeder Betroffene einzeln; Badge pro Person

---

## Datenmodell

### `restaurant_staff_todos`

- `title`, `description?`
- `restaurant_id`
- `assignee_type`: `staff` | `position_tag`
- `staff_id?`, `position_tag_id?`
- `priority`: `high` | `medium` | `low`
- `display_from?`, `display_until?` (optional)
- `show_on_display`
- `show_before_clock_in`, `show_before_break_start`, `show_before_break_end`, `show_before_clock_out`
- `completion_mode`: `any_one` | `each_assignee`
- `require_defer_reason`
- `blocks_shift_end`
- `sort_order`, `created_by`, `archived_at?`

### `restaurant_staff_todo_completions`

- `todo_id`, `staff_id` (wer markiert)
- `completed_at`, `reopened_at?`
- `confirmed_at` (nach „Wirklich erledigt?“)

### `restaurant_staff_todo_deferrals`

- `todo_id`, `staff_id`
- `trigger`: `clock_in` | `break_start` | `break_end` | `clock_out`
- `reason?`
- `deferred_at`
- **Kein** Ändern von `display_until` am ToDo
- Reaktivierung: **nächster gleicher Trigger**; bei Pflicht erneut Grund

### `restaurant_staff_todo_log_entries`

Append-only Audit (Dashboard-Protokoll + Notifications-Kontext):

- `todo_id`, `restaurant_id`
- `action`: `created` | `updated` | `archived` | `completed` | `reopened` | `deferred` | `completed_by_manager`
- `actor_user_id?`, `actor_staff_id?`
- `details` (JSONB: Grund, Trigger, Diff, …)

### `restaurant_staff_todo_settings` (pro Restaurant)

- `defer_reason_default`
- `notify_on_completed`, `notify_on_deferred` (Master-Schalter)

---

## Status (berechnet)

| Status | Regel |
|--------|--------|
| Geplant | `display_from` in der Zukunft |
| Offen | sichtbar, nicht erledigt |
| Überfällig | `display_until` überschritten, offen → **rot** |
| Teilweise | `each_assignee`, nicht alle erledigt |
| Erledigt | Completion-Regel erfüllt |
| Verschoben (Snooze) | aktive Deferral für MA am Trigger; Admin sieht Grund |

---

## Display

- **Badge** an `DisplayStaffLine` — bleibt bis erledigt (auch während Snooze im Popup)
- **Popup vor Trigger** — konfigurierbar pro ToDo
- **Schichtbeginn:** Popup, Start **immer** möglich
- **Schichtende** (`blocks_shift_end`): nur nach Erledigen oder Verschieben (Grund falls Pflicht)
- API: `/api/display/todos` (P2/P3)

---

## Benachrichtigungen

Module (Registry):

- `staff_todo_completed`
- `staff_todo_deferred`

Gruppe **Mitarbeiter** in Benachrichtigungs-Einstellungen. Empfang nur mit `staff_todos.read` + User-Toggle + Restaurant-Master (`notify_on_*`).

Sidebar optional: `mitarbeiter` zählt beide Module.

---

## UI-Muster

- Filter: Bottom Sheet (`StaffTodosFilterDrawer`)
- Formular: Bottom Sheet + `DrawerFormSection`
- Liste: `ListPaginationSurround`, Status-Farben, Sortierung Priorität/Fälligkeit
- Primär-CTA: `modulePrimaryAddButtonFullWidthClassName`

---

## Phasen

| Phase | Lieferumfang | Status |
|-------|----------------|--------|
| **P0** | Schema, Permissions, Liste, Anlegen/Bearbeiten-Drawer, Basis-Filter, Protokoll-Leseansicht | ✅ |
| **P1** | Profil-Abschnitt, `?staff=`, Einstellungen | ✅ |
| **P2** | Display-Badge | ✅ |
| **P3** | Schicht-Popups, Verschieben, Blockierung | ✅ |
| **P4** | Benachrichtigungen, Sidebar-Counts | ✅ |
| **Later** | Wiederkehrende ToDos | offen |

---

## Referenzen

- Staff-Nav: `apps/web/app/(platform)/(app)/dashboard/mitarbeiter/layout.tsx`
- CRUD-Permissions: `apps/web/lib/permissions/module-crud-permissions.ts`
- Notifications: `.cursor/rules/notification-modules-extensibility.mdc`
- Display-Zeit: `apps/web/components/display/modules/display-time-module.tsx`
