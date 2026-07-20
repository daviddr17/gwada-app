# Expo Staff — Entfernungs-Vorbereitung (nach Pilot-Signoff)

**Nicht ausführen**, bevor Phase-5-Pilot-Checklist signiert ist.

Soft-Freeze bleibt bis dahin: [`apps/staff/README.md`](../../apps/staff/README.md).

## Ziel

`apps/staff` (Expo) entfernen, nachdem Swift `apps/pos` + Nest `apps/pos-api` Parität §6 und Pilot-Schicht OK sind.

## Geplanter PR (Skeleton)

**Titel:** `chore: remove Expo apps/staff after Swift pilot signoff`

**Branch-Vorschlag:** `chore/remove-expo-staff`

### Löschen / Anpassen

1. Verzeichnis `apps/staff/` entfernen
2. `pnpm-workspace.yaml` — `apps/staff` Eintrag streichen
3. Root-/CI-Scripts, die `staff` bauen oder linten (GitHub Actions, Turbo, Docker)
4. Docs-Links: Soft-Freeze-Banner → „entfernt am …“, Plan §2 aktualisieren
5. Salvage-Notizen behalten unter `docs/plans/expo-staff-salvage-audit.md` (historisch)

### Nicht löschen

- `apps/pos`, `apps/pos-api`, `packages/pos-domain`
- Web POS `/dashboard/pos` und Next `/api/pos` bis Nest-Cutover abgeschlossen
- Supabase-Migrationen

### Verifikation vor Merge

- [ ] Pilot-Checklist signiert
- [ ] `pnpm install` + Web/pos-api CI grün ohne `staff`
- [ ] Keine Imports von `@gwada/staff` / Expo-Pfaden in Web
- [ ] TestFlight Build `apps/pos` aktuell auf Pilot-Geräten

## Status

Vorbereitung dokumentiert (Phase 5). **Lösch-PR erst nach Signoff öffnen.**
