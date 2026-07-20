# Gwada POS API (NestJS)

Cloud-API für die native Kellner-/Hub-App: Sessions, Zahlungen, Fiskaly, Mollie, Hub-Outbox-Sync.

## Endpoints (Phase 1)

| Method | Path | Auth |
|---|---|---|
| GET | `/health` | public |
| GET | `/v1/catalog?restaurantId=` | Service-Role env |
| GET | `/v1/branding?restaurantId=` | Service-Role env |

Env: `SUPABASE_URL` (oder `NEXT_PUBLIC_SUPABASE_URL`), `SUPABASE_SERVICE_ROLE_KEY`, optional `PORT` (default 3099).

## Lokal

```bash
# vom Repo-Root
pnpm install
pnpm --filter @gwada/pos-api start:dev
# → http://127.0.0.1:3099/health

pnpm --filter @gwada/pos-api smoke
```

## Pläne

- [`docs/plans/kellner-swift-native-plan.md`](../../docs/plans/kellner-swift-native-plan.md)
- [`docs/plans/kellner-event-protocol.md`](../../docs/plans/kellner-event-protocol.md)

Swift-Clients: [`apps/pos`](../pos) (Hub LAN) → später Outbox an diese API.

Web-Admin: POS → Einstellungen → Geräte & Rechte.