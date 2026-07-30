# Task 9 — Abschluss-Verifikation: POS Order-UI Fundament

Datum: 2026-07-30  
Branch: `cursor/kellner-swift-plan-main-3483`

## Checkliste

| Punkt | Status | Evidenz |
|---|---|---|
| 1. Dev-DB: `pos_order_lines.course` ist Integer, Enum entfernt | PASS | CI-Spot-Check [#30497710709](https://github.com/daviddr17/gwada-app/actions/runs/30497710709) (`Spot-check POS course int (dev)`) endete am 2026-07-29 22:54 UTC mit `success`. Die Migration `20260729213000_pos_order_course_int.sql` setzt `integer`, `NOT NULL`, Default `2`, Check `>= 1`, wandelt KDS nach `integer[]` und droppt `pos_order_course`. Ein erneuter Dispatch auf dem lokalen Feature-Branch war nicht möglich, da dieser Ref nicht auf GitHub vorhanden ist; der verifizierte CI-Run bleibt die aktuelle DB-Evidenz. |
| 2. POS-Domain-Tests | PASS | `pnpm --filter @gwada/pos-domain test`: 10 Tests, 0 Fehler (2026-07-30). |
| 3. Swift Build + Unit Tests | PASS | `xcodebuild -project GwadaPOS.xcodeproj -scheme GwadaPOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build && xcodebuild test ...`: `BUILD SUCCEEDED`, `TEST SUCCEEDED`; 24 XCTest-Tests, 0 Fehler (2026-07-30). |
| 4. Authentifizierter TableSession-/LineConfigure-/Fire-Smoke | SKIP | Kein Restaurant-Login bzw. bestehender TableSession für einen sicheren End-to-End-Lauf verfügbar. Statisch geprüft: `LineConfigureSheet` zeigt die Gänge 1–3 und erzeugt eine Int-`course`; die Fire-API normalisiert auf Int. XCTest deckt Course-Decoding, Side-Pool, Pairing und Hub-HTTP-Parsing ab, ersetzt aber keinen Auth-Smoke gegen Dev. |
| 6. Spec und Plan dokumentiert | PASS | `docs(pos): add phase-1 order UI foundation spec and plan` (`82e22d75`); nur die beiden angeforderten Dokumente committed. |

## Spec-Akzeptanzkriterien

| Kriterium | Status | Evidenz / Rest |
|---|---|---|
| 1. Dev-DB: Integer `course >= 1`, kein Enum | PASS | Erfolgreicher CI-Spot-Check #30497710709 und Migration. |
| 2. Nest + Web-Bootstrap + Swift nutzen Int-Gänge; 1/2/3-Labels | FAIL | Nest und Swift normalisieren/verwenden Int; Web-Bootstrap liefert die neue Menüform. Im Web bleiben aber `PosOrderDto.lines.course` und `PosKdsTicketLine.course` in `apps/web/lib/pos/pos-responses.ts` bzw. `pos-kds-server.ts` als `string` mit Fallback `"other"`. Diese öffentlichen Web/KDS-Ausgaben entsprechen noch nicht vollständig dem Int-Vertrag. |
| 3. Bootstrap Side-Preis/-Config, Swift Decode, Side-Pool | PASS | Bootstrap mappt `sidePriceCents` und `sides`; Swift-Modell und `PosMenuSidePool` vorhanden; Codable-/Pool-Tests bestanden. |
| 4. Tokens/Textstyles und Paper-Bon-Shell | PASS | `PosDesign` exponiert alle verlangten Tokens und System-Styles; `PaperReceiptView` hat Papierfarben, Sawtooth-Edges und DEBUG-Preview. Swift-Build bestanden. |
| 5. OptionGroup min/max-Helper, kein Pairing/Hub-Regressionssignal | PASS | `isSelectionCountValid`/`effectiveMaxSelect` vorhanden und getestet; 24 XCTest-Tests umfassen Pairing- und Hub-HTTP-Tests ohne Fehler. |

## Fazit

Die automatischen Domain- und Swift-Prüfungen sowie der Dev-DB-CI-Spot-Check sind grün. Vor Abschluss von Phase 1 müssen die verbliebenen Web-/KDS-Response-`course`-Strings auf `number` umgestellt und ein authentifizierter Dev-Smoke (TableSession → Gang 2 → Fire) ausgeführt werden.

## Nachtrag — Web/KDS Course-DTOs

Die verbliebenen öffentlichen Web-POS-, KDS-, Session-Settlement- und Move-Lines-DTOs geben `course` jetzt als `number` aus. Alle Web-Mappings normalisieren den Datenbankwert mit `normalizePosOrderCourse`, statt den Legacy-String-Fallback `"other"` zu senden. Die Nest-Services normalisieren Eingaben vor dem Persistieren bzw. Filtern; ihre Session-Antwort reicht die als `integer` migrierte Datenbankspalte unverändert als Zahl durch.
