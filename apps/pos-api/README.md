# Gwada POS API (NestJS)

Cloud-API für die native Kellner-/Hub-App: Sessions, Zahlungen, Fiskaly, Mollie, Hub-Outbox-Sync.

**Phase 0:** Scaffold + `GET /health` only.

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
