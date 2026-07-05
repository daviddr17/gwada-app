# Live deploy (App + DB)

Production: **`https://gwada.app`** — siehe [gwada-app-domains.md](./gwada-app-domains.md).

## Kurz

1. `git push origin main`
2. DB: `gh workflow run deploy-live-db.yml --ref main`
3. App: `gh workflow run deploy-live-app.yml --ref main`
4. Prüfen: `curl -s https://gwada.app/api/build-info`

Details: [coolify-live-deploy.md](./coolify-live-deploy.md)

## Domain-Cutover (einmalig)

```bash
bash scripts/vps-cutover-production-domain.sh
gh workflow run deploy-live-app.yml --ref main
```

DNS bei IONOS: `gwada.app` → VPS, `old.gwada.app` → Bubble.
