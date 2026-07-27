# iStoreOS deployment

The production image targets `linux/amd64`, runs as the non-root `node` user, serves the web application on port 3000, and persists only `/data` in the named volume `home-party-game-platform-data`.

## Automated deployment from Windows

The supported release entry point is `deploy/deploy.ps1`. It publishes only a clean, committed Git `HEAD`; builds the SHA-tagged image while the old service remains online; takes a stopped SQLite backup; switches the single release directory; waits for Docker health; and restores the old source, image, and database if the new service fails.

### Prerequisites

The Windows workstation needs:

- Windows PowerShell 5.1, Git, and the Windows OpenSSH `ssh` and `scp` commands on `PATH`.
- A committed Git `HEAD` and a completely clean worktree, including no untracked files.
- LAN access to the iStoreOS SSH service.

The iStoreOS host needs:

- A POSIX shell, `sha256sum`, `tar`, `awk`, `date`, `basename`, and `dirname`.
- Docker Engine and Docker Compose v2.
- The existing named volume `home-party-game-platform-data`.
- A writable parent directory for the configured release path and a separate writable backup directory.

The release and backup directories must be absolute POSIX paths without spaces. They cannot be equal or contain one another.

### Create the ignored local configuration

From the repository root:

```powershell
Copy-Item .\deploy\deploy.config.example.psd1 .\deploy\deploy.config.psd1
notepad .\deploy\deploy.config.psd1
```

`deploy/deploy.config.psd1` is Git-ignored. It accepts exactly these settings:

| Setting | Required | Default | Meaning |
| --- | --- | --- | --- |
| `SshHost` | yes | none | iStoreOS LAN IP address or DNS name |
| `SshUser` | yes | none | SSH account |
| `SshPort` | no | `22` | SSH port |
| `IdentityFile` | no | empty | Private-key path; a relative path is resolved from the config directory |
| `RemoteReleaseDir` | yes | none | The single formal release directory |
| `RemoteBackupDir` | yes | none | Separate directory containing the one database backup |
| `PartyPort` | no | `3000` | Host port published for the application |
| `HealthTimeoutSeconds` | no | `120` | Health deadline, from 10 through 1800 seconds |

Passwords are deliberately not configuration fields. Leave `IdentityFile` empty to let system OpenSSH prompt interactively, or set it to a private-key file. The script passes a key only as OpenSSH's separate `-i` argument and does not disable host-key verification. Confirm a new host fingerprint out of band before accepting it.

Explicit PowerShell parameters override config values. For example:

```powershell
powershell.exe -NoProfile -File .\deploy\deploy.ps1 -PartyPort 3100 -HealthTimeoutSeconds 180
```

### Deploy

Commit all intended files and verify the worktree is clean:

```powershell
git status --short
powershell.exe -NoProfile -File .\deploy\deploy.ps1
```

The command logs `preflight`, `upload`, `build`, `stop`, `backup`, `switch`, `health`, `rollback`, and `cleanup` stages as applicable. A completed deployment returns 0 and prints the Git SHA, SHA-tagged image, port, and health result. An unrecovered failure returns non-zero.

The source archive and `remote-deploy.sh` are read from the committed `HEAD`, not from uncommitted files. The archive excludes `.git`, the local deployment config, dependencies, build output, test output, and deployment state.

## Idempotency and retained state

The authoritative no-op condition is all of the following:

- local `HEAD` equals the remote `.release-sha`;
- the running container uses `home-party-game-platform:<full-SHA>`;
- the container is `healthy`.

When all three match, repeating the command returns 0 without upload, build, stop, backup, directory replacement, or container recreation. Live business data and the existing backup remain untouched. If the SHA matches but the image or health does not, the command enters the normal deployment/recovery path instead of masking the drift.

Permanent remote state is intentionally bounded:

- one formal directory at `RemoteReleaseDir`;
- one fixed backup at `RemoteBackupDir/platform.sqlite.backup`;
- the fixed named volume `home-party-game-platform-data`;
- the current SHA image.

For every non-no-op switch, the script stops writes, creates a temporary backup, verifies its SQLite header and non-empty content, and atomically replaces `platform.sqlite.backup`. A failed backup never overwrites the previous backup. Token directories, uploaded archives, locks, previous directories, failed directories, and rollback image tags are temporary and are removed after success or a successfully restored failure.

Git is the source history. The server does not retain old source releases, and the backup directory does not accumulate timestamped database copies.

## Failure and automatic recovery

- Upload, integrity, or build failure: the old service and fixed backup are unchanged.
- Backup failure after stop: the old service is restarted and checked for health; the previous backup remains.
- Switch, startup, or new-health failure: the new service is stopped, the old directory and image are restored, `platform.sqlite.backup` is copied back to the volume, SQLite WAL/SHM sidecars are removed, and the old service must become healthy. The deployment still returns non-zero.
- `INT` or `TERM`: before stop, temporary content is cleaned; after stop, the same recovery path runs.
- An abandoned lock records a token, process start identity, and stage. A later run rejects a live owner or recovers a provably stale owner before continuing.
- If this is the first deployment and no old image exists, the new service is stopped and the database is restored, but the recovery lock and diagnostics are preserved because no application version can be started automatically.
- If automatic rollback itself fails, the named volume, fixed backup, images, relevant directories, and recovery lock are preserved. Do not delete the volume, backup, or lock before inspection.

## Manual recovery

Use the paths and image names printed by the failed command. Replace every angle-bracket placeholder below before running a command.

1. Inspect the recorded stage and service logs without changing data:

   ```sh
   cat <release-dir>.deploy.lock/state
   (cd <release-dir>/deploy && PARTY_PORT=<port> PARTY_IMAGE=<recorded-image> docker compose logs home-table)
   docker volume inspect home-party-game-platform-data
   ls -l <backup-dir>/platform.sqlite.backup
   ```

2. Stop the failed service before restoring the database:

   ```sh
   (cd <release-dir>/deploy && PARTY_PORT=<port> PARTY_IMAGE=<recorded-image> docker compose stop home-table)
   ```

3. Restore the fixed backup with an available application image. This preserves the named volume and removes SQLite sidecars:

   ```sh
   docker run --rm --user 0:0 \
     -v home-party-game-platform-data:/data \
     -v <backup-dir>:/backup:ro \
     <available-application-image> \
     node -e 'const fs=require("fs");fs.copyFileSync("/backup/platform.sqlite.backup","/data/platform.sqlite");for(const p of ["/data/platform.sqlite-wal","/data/platform.sqlite-shm"]){try{fs.unlinkSync(p)}catch(e){if(e.code!=="ENOENT")throw e}}'
   ```

4. Ensure `<release-dir>` contains the source matching the known-good image, then recreate and verify the service:

   ```sh
   cd <release-dir>/deploy
   PARTY_PORT=<port> PARTY_IMAGE=<known-good-image> docker compose up -d --no-build --force-recreate home-table
   docker compose ps
   docker inspect --format '{{.State.Health.Status}}' "$(docker compose ps -q home-table)"
   ```

5. Only after the known-good service is healthy and the database is verified, remove the diagnosed recovery lock:

   ```sh
   rm -rf <release-dir>.deploy.lock
   ```

If the correct source directory is unavailable, check out its Git commit on the Windows workstation and redeploy as described below. Keep the fixed backup and named volume until the recovered application and data have been verified.

## Redeploy a Git history version

First confirm that the chosen application version is compatible with the current database schema. Then, on the Windows workstation:

```powershell
git switch --detach <commit-or-tag>
git status --short
powershell.exe -NoProfile -File .\deploy\deploy.ps1
git switch -
```

The detached checkout must be clean. The normal deployment command rebuilds that commit as a SHA image; no historical release directory is required on the server. Do not run an older application against a database whose schema it cannot read.

## Manual Compose start

For initial manual operation without the automation:

```sh
cd deploy
PARTY_PORT=3000 docker compose up -d --build
docker compose ps
```

Open `http://<iStoreOS-LAN-IP>:3000`; `/healthz` should return `{"status":"ok"}`. If unhealthy, run `docker compose logs home-table`.

Never run `docker compose down -v` or remove `home-party-game-platform-data`; it contains `platform.sqlite` and its SQLite WAL files.

## Validation boundary

The repository's local deployment suite uses temporary Git repositories and stateful fake OpenSSH/Docker commands:

```powershell
npm run test:deploy
```

It does not connect to iStoreOS and does not run Docker. A real first deployment and a repeated healthy-SHA no-op remain an explicit operator acceptance step; do not treat local simulation as evidence that a particular server was changed.
