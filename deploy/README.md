# iStoreOS deployment

The image is built for `linux/amd64`, runs as the non-root `node` user, contains all web assets and runtime dependencies, and uses `/data` as its only persistent path.

## Start

On an x86-64 iStoreOS host with Docker Compose:

```sh
cd deploy
PARTY_PORT=3000 docker compose up -d --build
docker compose ps
```

Open `http://<iStoreOS-LAN-IP>:3000`. The health endpoint is `/healthz`. Change `PARTY_PORT` when port 3000 is already reserved.

The named volume `home-party-game-platform-data` contains `platform.sqlite` plus SQLite WAL files. The application does not require a CDN, cloud database, external identity provider, or third-party realtime service after the image has been built.

## Backup and restore

Stop writes before a cold backup:

```sh
docker compose stop home-table
docker run --rm -v home-party-game-platform-data:/data -v "$PWD":/backup node:24.18.0-bookworm-slim \
  sh -c "cp /data/platform.sqlite /backup/platform.sqlite.backup"
docker compose start home-table
```

To restore, stop the service, keep a copy of the current database, place the backup at `/data/platform.sqlite` in the named volume, and start the service. Startup migrations are forward-only and idempotent.

## Upgrade and rollback

Build the replacement image before stopping the current container. For this initial schema, rollback means replacing the application container while retaining the named data volume. Never run an older image after a future release reports an incompatible database schema; take a volume backup first.

## Recovery checks

After a restart:

1. `docker compose ps` reports the service healthy.
2. `/healthz` returns `{"status":"ok"}`.
3. The lobby shows the expected current season, accounts, rooms, and leaderboard.
4. Reconnecting players recover their seats; unconfirmed browser chip caches do not appear as bets.

If the container is unhealthy, inspect `docker compose logs home-table`. Logs include command IDs, command types, aggregate IDs, rejection codes, migration results, and invariant failures; they redact connection leases, command payloads, decks, and hole cards.
