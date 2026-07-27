# Home Party Game Platform

A local-first, bilingual party-game platform with a complete Texas Hold'em first release. It provides password-free LAN accounts, rooms, seasons, conservation-based scores and chips, a responsive player interface, and read-only public displays.

## Development

Requirements:

- Node.js 20.13 or newer for local development
- npm 10 or newer
- Chromium and WebKit installed through Playwright for browser validation
- Docker with Linux/amd64 support for the production smoke gate

```sh
npm ci
npm run verify:core
npm run test:capacity
npm run build
npm run test:docker-smoke
```

The production server listens on `0.0.0.0:3000` by default, serves the built web client, and stores its SQLite database at `/data/platform.sqlite`.

## Trust boundary

This release is deliberately password-free and is intended only for a trusted household LAN. It still enforces one control lease per account, server-authoritative commands, asset invariants, read-only displays, and private-card projection boundaries. Do not expose it directly to the public internet.

See [deploy/README.md](deploy/README.md) for iStoreOS deployment, backup, recovery, and rollback.

## Automated iStoreOS deployment

From a Windows workstation, copy the ignored configuration template, commit the exact source to release, and run the single PowerShell entry point:

```powershell
Copy-Item .\deploy\deploy.config.example.psd1 .\deploy\deploy.config.psd1
notepad .\deploy\deploy.config.psd1
git status --short
powershell.exe -NoProfile -File .\deploy\deploy.ps1
```

The deployment is SHA-addressed and idempotent: when the same committed SHA is already running with its matching healthy image, the command succeeds without upload, build, backup, restart, or business-data changes. A non-no-op deployment keeps the old service online during the remote build, atomically maintains one configurable SQLite backup, and automatically restores the old image plus pre-deployment database if the new service fails.

The full configuration, authentication, retention, manual recovery, and Git-history redeployment procedures are in [deploy/README.md](deploy/README.md). Local automated tests do not use Docker or contact a server; the first real iStoreOS deployment and repeated no-op check must be performed separately by the operator.
