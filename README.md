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
