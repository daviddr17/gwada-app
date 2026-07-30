# Gwada POS API (NestJS)

Cloud-API für die native Kellner-/Hub-App.

## Phase-Status

| Phase | Inhalt |
|---|---|
| 0 | Health |
| 1 | Catalog + Branding |
| 2 | Sessions, Orders, Fire, Move, Release, Cash/Mollie-Simulate, TSE-Simulate, Sync-Ingest, Transfer |
| 3 | Hub-Outbox-Consumer in `apps/pos` (`PosNestClient` → `POST /v1/sync/events`) |

## Auth (Phase 2)

Header (vom Hub/Gerät):

- `X-Restaurant-Id` — UUID
- `X-Waiter-Profile-Id` — UUID
- `X-Device-Id` — optional, enrolltes Gerät

Env-Hilfen für lokale Tests: `POS_AUTH_RELAXED=1`, `POS_SKIP_REGISTER_CHECK=1`, `FISKALY_MODE=simulate` (default).

## Endpoints

| Method | Path | Beschreibung |
|---|---|---|
| GET | `/health` | public |
| GET | `/v1/catalog?restaurantId=` | Speisekarte + Optionen + Side-Config |
| GET | `/v1/branding?restaurantId=` | Accent + Venue |
| GET | `/v1/floor` | Tische + aktive Sessions |
| POST | `/v1/sessions/open` | Session öffnen |
| GET | `/v1/sessions/:id` | Summary |
| POST | `/v1/sessions/:id/bill` | Status → bill |
| POST | `/v1/sessions/:id/move` | `{ targetDiningTableId }` |
| POST | `/v1/sessions/:id/release` | schließen |
| POST | `/v1/orders` | `{ sessionId, items[] }` |
| POST | `/v1/orders/fire-course` | `{ sessionId, course }` |
| POST | `/v1/payments/cash` | Allocations + Tip + TSE-Receipt-Payload |
| POST | `/v1/payments/mollie` | Card/PayPal (ohne Key: simulate) |
| POST | `/v1/sync/events` | Hub-Outbox bulk (`idempotencyKey`) |
| POST | `/v1/shifts/transfer` | 4-Augen PIN |

## Lokal

```bash
pnpm install
export POS_AUTH_RELAXED=1 POS_SKIP_REGISTER_CHECK=1
export SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=…
pnpm --filter @gwada/pos-api start:dev
pnpm --filter @gwada/pos-api smoke
```

Beispiel Cash-Flow: siehe `docs/plans/kellner-pos-api-phase2-curl.md`.

## Pläne

- [`docs/plans/kellner-swift-native-plan.md`](../../docs/plans/kellner-swift-native-plan.md)
- [`docs/plans/kellner-event-protocol.md`](../../docs/plans/kellner-event-protocol.md)
