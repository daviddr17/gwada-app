# POS-API Phase 2 — Curl-Flow

Voraussetzungen: Nest läuft (`pnpm --filter @gwada/pos-api start:dev`),  
`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, optional `POS_AUTH_RELAXED=1` `POS_SKIP_REGISTER_CHECK=1`.

```bash
export BASE=http://127.0.0.1:3099
export RID=<restaurant-uuid>
export WID=<waiter-profile-uuid>
export HDR=(-H "X-Restaurant-Id: $RID" -H "X-Waiter-Profile-Id: $WID" -H "Content-Type: application/json")

# 1 Floor
curl -s "$BASE/v1/floor" "${HDR[@]}" | jq .

# 2 Session öffnen (Tisch-UUID aus Floor)
curl -s -X POST "$BASE/v1/sessions/open" "${HDR[@]}" \
  -d '{"diningTableId":"<table-uuid>","coverCount":2}' | jq .
export SID=<sessionId>

# 3 Bestellung
curl -s -X POST "$BASE/v1/orders" "${HDR[@]}" \
  -d '{"sessionId":"'"$SID"'","items":[{"menuItemId":"<item-uuid>","quantity":1,"course":"1"}]}' | jq .

# 4 Gang schicken
curl -s -X POST "$BASE/v1/orders/fire-course" "${HDR[@]}" \
  -d '{"sessionId":"'"$SID"'","course":"starter"}' | jq .

# 5 Summary → line ids
curl -s "$BASE/v1/sessions/$SID" "${HDR[@]}" | jq .

# 6 Bar zahlen (Allocation)
curl -s -X POST "$BASE/v1/payments/cash" "${HDR[@]}" \
  -d '{"sessionId":"'"$SID"'","allocations":[{"orderLineId":"<line-uuid>","quantity":1}],"tipCents":100,"receivedAmountCents":5000}' | jq .

# 7 Freigeben (nach fullyPaid)
curl -s -X POST "$BASE/v1/sessions/$SID/release" "${HDR[@]}" | jq .

# Sync-Beispiel
curl -s -X POST "$BASE/v1/sync/events" "${HDR[@]}" \
  -d '{"events":[{"idempotencyKey":"hub:session.open:demo-1","type":"session.opened","payload":{"diningTableId":"<table-uuid>","coverCount":2}}]}' | jq .
```

TSE: Bei `FISKALY_MODE=simulate` enthält die Payment-Response `tse.receipt` mit Signatur-Feldern und legt eine `pos_fiscal_transactions`-Zeile an.
