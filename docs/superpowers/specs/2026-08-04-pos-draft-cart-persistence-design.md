# POS Entwurf-Cart Persistenz — Design

**Datum:** 2026-08-04  
**Status:** Approved

## Entscheidungen

| Thema | Wahl |
|-------|------|
| Key | Session wenn real, sonst Tisch; Remap Tisch→Session |
| Persistenz | Disk (`PosLocalStore`) |
| Löschen | Freigeben, Entwurf leeren, remote Session weg; Schicken nur Gang |

## Implementierung

- `PosCartLine` / `PosCartModifier`: `Codable`
- `PosDraftCartStore`: load/save/clear/remap keys `session:` / `table:`
- `TableSessionView`: restore on appear/task; persist on cart change; clear on release path
- Hub `releaseLocalSession`: clear draft for session (+ table if known)
