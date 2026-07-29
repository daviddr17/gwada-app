# GitHub App Auth für Superadmin Deploy (ohne ablaufende PATs)

Die Live-App mintet **kurzlebige Installation-Tokens** aus einer GitHub App.
Der **Private Key läuft nicht ab** — kein manuelles PAT-Rotieren mehr für
GitHub-Vergleich, Deploy-Trigger, WAHA-Restart usw.

PAT (`GWADA_GITHUB_DEPLOY_TOKEN`) bleibt optionaler Fallback (z. B. GHCR).

## Einmalig: GitHub App anlegen

1. Öffne [GitHub → Settings → Developer settings → GitHub Apps → New](https://github.com/settings/apps/new).
2. Name z. B. `Gwada Deploy`, Homepage `https://gwada.app`.
3. Webhook: **Inactive**.
4. Repository permissions:
   - **Metadata**: Read
   - **Contents**: Read
   - **Actions**: Read & write
   - **Workflows**: Read & write (falls angeboten)
   - **Packages**: Read (optional, für GHCR)
5. „Only on this account“ → Create.
6. **Generate a private key** → `.pem` speichern.
7. App auf Repo `daviddr17/gwada-app` **installieren** → Installation-ID aus der URL:
   `https://github.com/settings/installations/<INSTALLATION_ID>`.
8. App-ID steht auf der App-Seite („App ID“).

Alternativ Manifest: `scripts/github-deploy-app-manifest.json` — unter
[github.com/settings/apps/new](https://github.com/settings/apps/new) als
„GitHub App Manifest“ nutzen (Feld `manifest`).

## Secrets setzen (GitHub Repo)

| Secret | Inhalt |
|--------|--------|
| `GWADA_GITHUB_APP_ID` | numerische App-ID |
| `GWADA_GITHUB_APP_INSTALLATION_ID` | Installation-ID |
| `GWADA_GITHUB_APP_PRIVATE_KEY` | PEM (inkl. `BEGIN`/`END`) oder Base64 der PEM |

## Auf Live-VPS syncen

```bash
gh workflow run sync-github-app-credentials-live.yml --ref main
gh run watch --workflow=sync-github-app-credentials-live.yml --exit-status
```

Schreibt `GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, `GITHUB_APP_PRIVATE_KEY`
(Base64) in die Coolify-`.env` und recreate’t den App-Container.

## Verhalten in der App

`apps/web/lib/superadmin/github-app-auth-server.ts` mintet bei Bedarf ein
Installation-Token (~1 h), cached es im Prozess und fällt bei Fehler auf PAT zurück.

Env-Aliase: `GWADA_GITHUB_APP_*` oder `GITHUB_APP_*`.
