#!/bin/sh

set -u

PROGRAM="home-table-deploy"
SERVICE="home-table"
VOLUME="home-party-game-platform-data"
IMAGE_REPOSITORY="home-party-game-platform"
BACKUP_NAME="platform.sqlite.backup"

MODE=""
SHA=""
ARCHIVE_PATH=""
ARCHIVE_HASH=""
SCRIPT_HASH=""
RELEASE_DIR=""
BACKUP_DIR=""
PARTY_PORT=""
HEALTH_TIMEOUT=""
TOKEN=""

NEW_IMAGE=""
ROLLBACK_IMAGE=""
LOCK_DIR=""
LOCK_STATE=""
UPLOAD_DIR=""
INCOMING_DIR=""
PREVIOUS_DIR=""
FAILED_DIR=""
BACKUP_FILE=""
BACKUP_TMP=""

STAGE="preflight"
LOCK_HELD=0
SUCCESS=0
FINISHING=0
PATHS_READY=0
HAD_OLD=0
OLD_CONTAINER=""
OLD_IMAGE=""
FAILURE_MESSAGE=""
RECOVERY_FAILED=0

log() {
  log_stage=$1
  shift
  printf '[%s] %s\n' "$log_stage" "$*"
}

fail() {
  FAILURE_MESSAGE=$*
  log "error" "$FAILURE_MESSAGE" >&2
  exit 1
}

is_uint() {
  case "$1" in
    ""|*[!0-9]*) return 1 ;;
    *) return 0 ;;
  esac
}

is_safe_token() {
  case "$1" in
    ""|*[!0-9a-f]*) return 1 ;;
    *)
      [ "${#1}" -eq 32 ]
      return
      ;;
  esac
}

is_full_sha() {
  case "$1" in
    ""|*[!0-9a-f]*) return 1 ;;
    *)
      [ "${#1}" -eq 40 ]
      return
      ;;
  esac
}

is_hash() {
  case "$1" in
    ""|*[!0-9a-f]*) return 1 ;;
    *)
      [ "${#1}" -eq 64 ]
      return
      ;;
  esac
}

is_safe_absolute_path() {
  safe_path=$1
  case "$safe_path" in
    /|""|*/|*[!A-Za-z0-9_./@%+=,-]*) return 1 ;;
    /*) ;;
    *) return 1 ;;
  esac
  case "/${safe_path#/}/" in
    */../*|*/./*) return 1 ;;
  esac
  return 0
}

paths_overlap() {
  overlap_left=$1
  overlap_right=$2
  [ "$overlap_left" = "$overlap_right" ] && return 0
  case "$overlap_left/" in
    "$overlap_right/"*) return 0 ;;
  esac
  case "$overlap_right/" in
    "$overlap_left/"*) return 0 ;;
  esac
  return 1
}

process_start_id() {
  process_id=$1
  if [ -r "/proc/$process_id/stat" ]; then
    awk '{ print $22 }' "/proc/$process_id/stat" 2>/dev/null || true
  fi
}

file_value() {
  value_file=$1
  value_key=$2
  if [ ! -f "$value_file" ]; then
    return 0
  fi
  awk -F= -v wanted="$value_key" '
    $1 == wanted {
      sub(/^[^=]*=/, "")
      value = $0
    }
    END { print value }
  ' "$value_file" 2>/dev/null || true
}

safe_remove_dir() {
  remove_path=$1
  expected_path=$2
  if [ -z "$remove_path" ] || [ "$remove_path" != "$expected_path" ]; then
    log "cleanup" "Refusing to remove an unexpected path: $remove_path" >&2
    return 1
  fi
  if [ -e "$remove_path" ]; then
    rm -rf "$remove_path"
  fi
}

safe_remove_file() {
  remove_path=$1
  expected_path=$2
  if [ -z "$remove_path" ] || [ "$remove_path" != "$expected_path" ]; then
    log "cleanup" "Refusing to remove an unexpected file: $remove_path" >&2
    return 1
  fi
  if [ -e "$remove_path" ]; then
    rm -f "$remove_path"
  fi
}

compose() {
  compose_root=$1
  compose_image=$2
  shift 2
  (
    cd "$compose_root/deploy" &&
      PARTY_IMAGE="$compose_image" PARTY_PORT="$PARTY_PORT" docker compose "$@"
  )
}

compose_container() {
  container_root=$1
  container_image=$2
  if [ ! -d "$container_root/deploy" ]; then
    return 0
  fi
  compose "$container_root" "$container_image" ps -q "$SERVICE" 2>/dev/null || true
}

container_image() {
  inspect_container=$1
  docker inspect --format '{{.Config.Image}}' "$inspect_container" 2>/dev/null || true
}

container_health() {
  inspect_container=$1
  docker inspect --format '{{.State.Health.Status}}' "$inspect_container" 2>/dev/null || true
}

container_restarts() {
  inspect_container=$1
  docker inspect --format '{{.RestartCount}}' "$inspect_container" 2>/dev/null || printf '0\n'
}

wait_for_health() {
  wait_root=$1
  wait_image=$2
  wait_label=$3
  wait_deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))
  wait_container=""
  wait_initial_restarts=""

  while [ "$(date +%s)" -le "$wait_deadline" ]; do
    wait_container=$(compose_container "$wait_root" "$wait_image")
    if [ -n "$wait_container" ]; then
      wait_status=$(container_health "$wait_container")
      wait_restarts=$(container_restarts "$wait_container")
      if [ -z "$wait_initial_restarts" ]; then
        wait_initial_restarts=$wait_restarts
      fi
      if [ "$wait_status" = "healthy" ]; then
        sleep 2
        wait_confirmed_health=$(container_health "$wait_container")
        wait_confirmed_restarts=$(container_restarts "$wait_container")
        if [ "$wait_confirmed_health" = "healthy" ] &&
          [ "$wait_confirmed_restarts" = "$wait_restarts" ]; then
          log "health" "$wait_label is healthy (container $wait_container)."
          return 0
        fi
      fi
      if [ "$wait_status" = "unhealthy" ]; then
        log "health" "$wait_label became unhealthy." >&2
        return 1
      fi
      if is_uint "$wait_initial_restarts" && is_uint "$wait_restarts"; then
        if [ "$wait_restarts" -gt $((wait_initial_restarts + 3)) ]; then
          log "health" "$wait_label is repeatedly restarting." >&2
          return 1
        fi
      fi
    fi
    sleep 2
  done

  log "health" "$wait_label did not become healthy within ${HEALTH_TIMEOUT}s." >&2
  return 1
}

write_owner() {
  owner_start=$(process_start_id $$)
  owner_tmp="$LOCK_DIR/owner.tmp.$TOKEN"
  {
    printf 'PID=%s\n' "$$"
    printf 'START=%s\n' "$owner_start"
    printf 'TOKEN=%s\n' "$TOKEN"
    printf 'SHA=%s\n' "$SHA"
  } > "$owner_tmp"
  mv -f "$owner_tmp" "$LOCK_DIR/owner"
}

write_state() {
  STAGE=$1
  if [ "$LOCK_HELD" -ne 1 ]; then
    return 0
  fi
  state_tmp="$LOCK_DIR/state.tmp.$TOKEN"
  {
    printf 'STAGE=%s\n' "$STAGE"
    printf 'TOKEN=%s\n' "$TOKEN"
    printf 'SHA=%s\n' "$SHA"
    printf 'HAD_OLD=%s\n' "$HAD_OLD"
    printf 'OLD_CONTAINER=%s\n' "$OLD_CONTAINER"
    printf 'OLD_IMAGE=%s\n' "$OLD_IMAGE"
    printf 'NEW_IMAGE=%s\n' "$NEW_IMAGE"
    printf 'ROLLBACK_IMAGE=%s\n' "$ROLLBACK_IMAGE"
  } > "$state_tmp"
  mv -f "$state_tmp" "$LOCK_STATE"
}

lock_owner_is_active() {
  owner_file="$LOCK_DIR/owner"
  lock_pid=$(file_value "$owner_file" "PID")
  lock_start=$(file_value "$owner_file" "START")
  if ! is_uint "$lock_pid"; then
    return 1
  fi
  if ! kill -0 "$lock_pid" 2>/dev/null; then
    return 1
  fi
  current_start=$(process_start_id "$lock_pid")
  [ -n "$lock_start" ] && [ "$lock_start" = "$current_start" ]
}

is_noop() {
  [ -f "$RELEASE_DIR/.release-sha" ] || return 1
  marker=$(cat "$RELEASE_DIR/.release-sha" 2>/dev/null || true)
  [ "$marker" = "$SHA" ] || return 1
  noop_container=$(compose_container "$RELEASE_DIR" "$NEW_IMAGE")
  [ -n "$noop_container" ] || return 1
  [ "$(container_image "$noop_container")" = "$NEW_IMAGE" ] || return 1
  [ "$(container_health "$noop_container")" = "healthy" ] || return 1
  return 0
}

backup_database() {
  log "backup" "Creating a stopped SQLite backup at $BACKUP_FILE."
  mkdir -p "$BACKUP_DIR"
  safe_remove_file "$BACKUP_TMP" "$BACKUP_DIR/.platform.sqlite.backup.$TOKEN.tmp"

  backup_js='const fs=require("fs");const src="/data/platform.sqlite";const dst=process.argv[1];const st=fs.statSync(src);if(st.size<100)throw new Error("database is too small");const fd=fs.openSync(src,"r");const h=Buffer.alloc(16);fs.readSync(fd,h,0,16,0);fs.closeSync(fd);if(h.toString("binary")!=="SQLite format 3\u0000")throw new Error("invalid SQLite header");fs.copyFileSync(src,dst);const out=fs.openSync(dst,"r+");fs.fsyncSync(out);fs.closeSync(out);'
  if ! docker run --rm --user 0:0 \
    -v "${VOLUME}:/data:ro" \
    -v "${BACKUP_DIR}:/backup" \
    "$NEW_IMAGE" \
    node -e "$backup_js" "/backup/$(basename "$BACKUP_TMP")"; then
    safe_remove_file "$BACKUP_TMP" "$BACKUP_DIR/.platform.sqlite.backup.$TOKEN.tmp" || true
    return 1
  fi
  if [ ! -s "$BACKUP_TMP" ]; then
    safe_remove_file "$BACKUP_TMP" "$BACKUP_DIR/.platform.sqlite.backup.$TOKEN.tmp" || true
    return 1
  fi
  mv -f "$BACKUP_TMP" "$BACKUP_FILE"
}

restore_database() {
  restore_image=$1
  if [ ! -s "$BACKUP_FILE" ]; then
    log "rollback" "The deployment backup is missing or empty: $BACKUP_FILE" >&2
    return 1
  fi
  restore_js='const fs=require("fs");const src="/backup/platform.sqlite.backup";const dst="/data/platform.sqlite";const h=Buffer.alloc(16);const fd=fs.openSync(src,"r");fs.readSync(fd,h,0,16,0);fs.closeSync(fd);if(h.toString("binary")!=="SQLite format 3\u0000")throw new Error("invalid SQLite backup");fs.copyFileSync(src,dst);for(const p of [dst+"-wal",dst+"-shm"]){try{fs.unlinkSync(p)}catch(e){if(e.code!=="ENOENT")throw e}}const out=fs.openSync(dst,"r+");fs.fsyncSync(out);fs.closeSync(out);'
  docker run --rm --user 0:0 \
    -v "${VOLUME}:/data" \
    -v "${BACKUP_DIR}:/backup:ro" \
    "$restore_image" \
    node -e "$restore_js"
}

cleanup_token_paths() {
  cleanup_token=$1
  cleanup_upload="${RELEASE_DIR}.upload.${cleanup_token}"
  cleanup_incoming="${RELEASE_DIR}.incoming.${cleanup_token}"
  cleanup_previous="${RELEASE_DIR}.previous.${cleanup_token}"
  cleanup_failed="${RELEASE_DIR}.failed.${cleanup_token}"
  cleanup_backup_tmp="$BACKUP_DIR/.platform.sqlite.backup.${cleanup_token}.tmp"

  safe_remove_file "$cleanup_backup_tmp" "$BACKUP_DIR/.platform.sqlite.backup.${cleanup_token}.tmp" || true
  safe_remove_dir "$cleanup_upload" "${RELEASE_DIR}.upload.${cleanup_token}" || true
  safe_remove_dir "$cleanup_incoming" "${RELEASE_DIR}.incoming.${cleanup_token}" || true
  safe_remove_dir "$cleanup_previous" "${RELEASE_DIR}.previous.${cleanup_token}" || true
  safe_remove_dir "$cleanup_failed" "${RELEASE_DIR}.failed.${cleanup_token}" || true
}

recover_active_state() {
  log "rollback" "Recovering deployment stage '$STAGE'."

  case "$STAGE" in
    preflight|locked|verified|built)
      if [ -n "$ROLLBACK_IMAGE" ] &&
        docker image inspect "$ROLLBACK_IMAGE" >/dev/null 2>&1; then
        docker image rm "$ROLLBACK_IMAGE" >/dev/null 2>&1 || true
      fi
      return 0
      ;;
    stopping|stopped|backing_up|backed_up)
      safe_remove_file "$BACKUP_TMP" "$BACKUP_DIR/.platform.sqlite.backup.$TOKEN.tmp" || true
      if [ "$HAD_OLD" -eq 1 ]; then
        if ! compose "$RELEASE_DIR" "$OLD_IMAGE" start "$SERVICE"; then
          return 1
        fi
        if ! wait_for_health "$RELEASE_DIR" "$OLD_IMAGE" "Restored previous service"; then
          return 1
        fi
        return 0
      fi
      return 0
      ;;
    swapping|directories_swapped|new_starting|new_started|healthy|rollback_failed)
      if [ -d "$RELEASE_DIR/deploy" ]; then
        compose "$RELEASE_DIR" "$NEW_IMAGE" stop "$SERVICE" >/dev/null 2>&1 || true
      fi

      if [ -d "$PREVIOUS_DIR" ]; then
        if [ -e "$FAILED_DIR" ]; then
          log "rollback" "Cannot use occupied recovery path $FAILED_DIR." >&2
          return 1
        fi
        if [ -e "$RELEASE_DIR" ]; then
          mv "$RELEASE_DIR" "$FAILED_DIR" || return 1
        fi
        mv "$PREVIOUS_DIR" "$RELEASE_DIR" || return 1
      elif [ ! -d "$RELEASE_DIR/deploy" ] && [ "$HAD_OLD" -eq 1 ]; then
        log "rollback" "The previous release directory is unavailable." >&2
        return 1
      fi

      restore_helper=$ROLLBACK_IMAGE
      if ! docker image inspect "$restore_helper" >/dev/null 2>&1; then
        restore_helper=$OLD_IMAGE
      fi
      if [ -z "$restore_helper" ] || ! docker image inspect "$restore_helper" >/dev/null 2>&1; then
        restore_helper=$NEW_IMAGE
      fi
      if ! restore_database "$restore_helper"; then
        return 1
      fi

      if [ "$HAD_OLD" -ne 1 ]; then
        log "rollback" "No previous image exists; the new service is stopped and the database backup was restored." >&2
        return 2
      fi

      recovery_compose_image=$OLD_IMAGE
      if ! docker image inspect "$recovery_compose_image" >/dev/null 2>&1; then
        recovery_compose_image=$ROLLBACK_IMAGE
      fi
      if docker image inspect "$ROLLBACK_IMAGE" >/dev/null 2>&1; then
        case "$OLD_IMAGE" in
          sha256:*) ;;
          *) docker image tag "$ROLLBACK_IMAGE" "$OLD_IMAGE" >/dev/null 2>&1 || true ;;
        esac
      fi
      if ! compose "$RELEASE_DIR" "$recovery_compose_image" up -d --no-build --force-recreate "$SERVICE"; then
        return 1
      fi
      if ! wait_for_health "$RELEASE_DIR" "$recovery_compose_image" "Restored previous service"; then
        return 1
      fi

      if [ -d "$FAILED_DIR" ]; then
        safe_remove_dir "$FAILED_DIR" "${RELEASE_DIR}.failed.${TOKEN}" || return 1
      fi
      docker image rm "$NEW_IMAGE" >/dev/null 2>&1 || true
      docker image rm "$ROLLBACK_IMAGE" >/dev/null 2>&1 || true
      return 0
      ;;
    committed)
      if [ -n "$ROLLBACK_IMAGE" ] &&
        docker image inspect "$ROLLBACK_IMAGE" >/dev/null 2>&1; then
        docker image rm "$ROLLBACK_IMAGE" >/dev/null 2>&1 || return 1
      fi
      return 0
      ;;
    *)
      log "rollback" "Unknown recorded stage '$STAGE'; refusing automatic cleanup." >&2
      return 1
      ;;
  esac
}

recover_stale_lock() {
  stale_state="$LOCK_DIR/state"
  stale_stage=$(file_value "$stale_state" "STAGE")
  stale_token=$(file_value "$stale_state" "TOKEN")
  stale_sha=$(file_value "$stale_state" "SHA")
  stale_had_old=$(file_value "$stale_state" "HAD_OLD")
  stale_old_container=$(file_value "$stale_state" "OLD_CONTAINER")
  stale_old_image=$(file_value "$stale_state" "OLD_IMAGE")
  stale_new_image=$(file_value "$stale_state" "NEW_IMAGE")
  stale_rollback_image=$(file_value "$stale_state" "ROLLBACK_IMAGE")

  if ! is_safe_token "$stale_token"; then
    log "preflight" "The stale lock has invalid metadata; manual inspection is required." >&2
    return 1
  fi

  saved_token=$TOKEN
  saved_sha=$SHA
  saved_stage=$STAGE
  saved_had_old=$HAD_OLD
  saved_old_container=$OLD_CONTAINER
  saved_old_image=$OLD_IMAGE
  saved_new_image=$NEW_IMAGE
  saved_rollback_image=$ROLLBACK_IMAGE
  saved_upload=$UPLOAD_DIR
  saved_incoming=$INCOMING_DIR
  saved_previous=$PREVIOUS_DIR
  saved_failed=$FAILED_DIR
  saved_backup_tmp=$BACKUP_TMP

  TOKEN=$stale_token
  SHA=$stale_sha
  STAGE=${stale_stage:-preflight}
  HAD_OLD=${stale_had_old:-0}
  OLD_CONTAINER=$stale_old_container
  OLD_IMAGE=$stale_old_image
  NEW_IMAGE=$stale_new_image
  ROLLBACK_IMAGE=$stale_rollback_image
  UPLOAD_DIR="${RELEASE_DIR}.upload.${TOKEN}"
  INCOMING_DIR="${RELEASE_DIR}.incoming.${TOKEN}"
  PREVIOUS_DIR="${RELEASE_DIR}.previous.${TOKEN}"
  FAILED_DIR="${RELEASE_DIR}.failed.${TOKEN}"
  BACKUP_TMP="$BACKUP_DIR/.platform.sqlite.backup.${TOKEN}.tmp"

  log "preflight" "Recovering stale deployment token $TOKEN at stage $STAGE."
  if recover_active_state; then
    cleanup_token_paths "$TOKEN"
    rm -rf "$LOCK_DIR"
    stale_result=0
  else
    stale_result=$?
    log "rollback" "Stale deployment recovery failed; preserving $LOCK_DIR for the next recovery attempt." >&2
  fi

  TOKEN=$saved_token
  SHA=$saved_sha
  STAGE=$saved_stage
  HAD_OLD=$saved_had_old
  OLD_CONTAINER=$saved_old_container
  OLD_IMAGE=$saved_old_image
  NEW_IMAGE=$saved_new_image
  ROLLBACK_IMAGE=$saved_rollback_image
  UPLOAD_DIR=$saved_upload
  INCOMING_DIR=$saved_incoming
  PREVIOUS_DIR=$saved_previous
  FAILED_DIR=$saved_failed
  BACKUP_TMP=$saved_backup_tmp

  return "$stale_result"
}

acquire_lock() {
  if mkdir "$LOCK_DIR" 2>/dev/null; then
    LOCK_HELD=1
    write_owner
    write_state "locked"
    return 0
  fi

  if lock_owner_is_active; then
    lock_token=$(file_value "$LOCK_DIR/owner" "TOKEN")
    log "preflight" "Another deployment is active (token ${lock_token:-unknown})." >&2
    return 1
  fi

  if ! recover_stale_lock; then
    return 1
  fi
  if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    log "preflight" "Could not acquire the deployment lock after stale recovery." >&2
    return 1
  fi
  LOCK_HELD=1
  write_owner
  write_state "locked"
}

release_lock() {
  if [ "$LOCK_HELD" -eq 1 ]; then
    rm -rf "$LOCK_DIR"
    LOCK_HELD=0
  fi
}

finish() {
  finish_code=$?
  trap - 0 1 2 15
  if [ "$FINISHING" -eq 1 ]; then
    exit "$finish_code"
  fi
  FINISHING=1

  if [ "$SUCCESS" -eq 1 ]; then
    exit "$finish_code"
  fi

  if [ "$LOCK_HELD" -eq 1 ]; then
    if recover_active_state; then
      cleanup_token_paths "$TOKEN"
      release_lock
      if [ "$STAGE" != "preflight" ] && [ "$STAGE" != "locked" ]; then
        log "rollback" "The previous safe state was restored. The deployment still failed." >&2
      fi
    else
      RECOVERY_FAILED=1
      write_state "rollback_failed"
      log "rollback" "Automatic recovery failed. The named volume and backup were preserved." >&2
      log "rollback" "Inspect: (cd '$RELEASE_DIR/deploy' && docker compose logs $SERVICE)" >&2
      log "rollback" "Backup: $BACKUP_FILE" >&2
      log "rollback" "Recovery lock: $LOCK_DIR" >&2
    fi
  else
    if [ "$PATHS_READY" -eq 1 ]; then
      cleanup_token_paths "$TOKEN"
    fi
  fi

  if [ "$finish_code" -eq 0 ]; then
    finish_code=1
  fi
  exit "$finish_code"
}

trap finish 0
trap 'FAILURE_MESSAGE="Deployment interrupted"; exit 130' 1 2 15

if [ "$#" -ne 10 ]; then
  fail "Usage: remote-deploy.sh deploy SHA ARCHIVE ARCHIVE_HASH SCRIPT_HASH RELEASE_DIR BACKUP_DIR PARTY_PORT HEALTH_TIMEOUT TOKEN"
fi

MODE=$1
SHA=$2
ARCHIVE_PATH=$3
ARCHIVE_HASH=$4
SCRIPT_HASH=$5
RELEASE_DIR=$6
BACKUP_DIR=$7
PARTY_PORT=$8
HEALTH_TIMEOUT=$9
shift 9
TOKEN=$1

[ "$MODE" = "deploy" ] || fail "Unsupported mode '$MODE'."
is_full_sha "$SHA" || fail "SHA must be a lowercase 40-character Git commit."
is_hash "$ARCHIVE_HASH" || fail "Archive hash is invalid."
is_hash "$SCRIPT_HASH" || fail "Script hash is invalid."
is_safe_token "$TOKEN" || fail "Deployment token is invalid."
is_safe_absolute_path "$RELEASE_DIR" || fail "Release directory is unsafe."
is_safe_absolute_path "$BACKUP_DIR" || fail "Backup directory is unsafe."
paths_overlap "$RELEASE_DIR" "$BACKUP_DIR" &&
  fail "Release and backup directories cannot contain one another."
is_uint "$PARTY_PORT" || fail "Party port is invalid."
is_uint "$HEALTH_TIMEOUT" || fail "Health timeout is invalid."
[ "$PARTY_PORT" -ge 1 ] && [ "$PARTY_PORT" -le 65535 ] || fail "Party port is out of range."
[ "$HEALTH_TIMEOUT" -ge 10 ] && [ "$HEALTH_TIMEOUT" -le 1800 ] ||
  fail "Health timeout is out of range."

NEW_IMAGE="$IMAGE_REPOSITORY:$SHA"
ROLLBACK_IMAGE="$IMAGE_REPOSITORY:rollback-$TOKEN"
LOCK_DIR="${RELEASE_DIR}.deploy.lock"
LOCK_STATE="$LOCK_DIR/state"
UPLOAD_DIR="${RELEASE_DIR}.upload.${TOKEN}"
INCOMING_DIR="${RELEASE_DIR}.incoming.${TOKEN}"
PREVIOUS_DIR="${RELEASE_DIR}.previous.${TOKEN}"
FAILED_DIR="${RELEASE_DIR}.failed.${TOKEN}"
BACKUP_FILE="$BACKUP_DIR/$BACKUP_NAME"
BACKUP_TMP="$BACKUP_DIR/.platform.sqlite.backup.${TOKEN}.tmp"

[ "$ARCHIVE_PATH" = "$UPLOAD_DIR/source.tar.gz" ] ||
  fail "Archive path does not match the deployment token."
[ "$0" = "$UPLOAD_DIR/remote-deploy.sh" ] ||
  fail "Remote script path does not match the deployment token."
PATHS_READY=1

for required_command in docker sha256sum tar awk date basename dirname; do
  command -v "$required_command" >/dev/null 2>&1 ||
    fail "Required remote command '$required_command' is unavailable."
done
docker compose version >/dev/null 2>&1 || fail "docker compose is unavailable."

actual_script_hash=$(sha256sum "$0" | awk '{ print $1 }')
[ "$actual_script_hash" = "$SCRIPT_HASH" ] || fail "Remote script integrity check failed."

release_parent=$(dirname "$RELEASE_DIR")
[ -d "$release_parent" ] && [ -w "$release_parent" ] ||
  fail "Release parent '$release_parent' is not writable."

log "preflight" "Acquiring the deployment lock."
if ! acquire_lock; then
  cleanup_token_paths "$TOKEN"
  fail "A deployment lock is active or could not be recovered."
fi

if is_noop; then
  log "health" "Git $SHA already matches the running healthy image; no upload content will be applied."
  cleanup_token_paths "$TOKEN"
  release_lock
  SUCCESS=1
  exit 0
fi

docker volume inspect "$VOLUME" >/dev/null 2>&1 ||
  fail "Named volume '$VOLUME' does not exist; refusing to create or replace it."
mkdir -p "$BACKUP_DIR" || fail "Backup directory '$BACKUP_DIR' is not writable."
[ -w "$BACKUP_DIR" ] || fail "Backup directory '$BACKUP_DIR' is not writable."

log "upload" "Verifying and extracting committed source."
actual_archive_hash=$(sha256sum "$ARCHIVE_PATH" | awk '{ print $1 }')
[ "$actual_archive_hash" = "$ARCHIVE_HASH" ] || fail "Source archive integrity check failed."
[ ! -e "$INCOMING_DIR" ] || fail "Incoming directory already exists: $INCOMING_DIR"
mkdir "$INCOMING_DIR" || fail "Could not create incoming directory."
tar -xzf "$ARCHIVE_PATH" -C "$INCOMING_DIR" || fail "Could not extract the source archive."
[ -f "$INCOMING_DIR/deploy/compose.yml" ] || fail "The source archive lacks deploy/compose.yml."
[ -f "$INCOMING_DIR/deploy/remote-deploy.sh" ] ||
  fail "The source archive lacks deploy/remote-deploy.sh."
write_state "verified"

log "build" "Building $NEW_IMAGE while the existing service remains running."
compose "$INCOMING_DIR" "$NEW_IMAGE" build "$SERVICE" ||
  fail "Docker Compose image build failed."
docker image inspect "$NEW_IMAGE" >/dev/null 2>&1 ||
  fail "The built image '$NEW_IMAGE' cannot be inspected."

if [ -d "$RELEASE_DIR/deploy" ]; then
  OLD_CONTAINER=$(compose_container "$RELEASE_DIR" "$NEW_IMAGE")
fi
if [ -n "$OLD_CONTAINER" ]; then
  OLD_IMAGE=$(container_image "$OLD_CONTAINER")
  [ -n "$OLD_IMAGE" ] || fail "Could not identify the running image."
  docker image inspect "$OLD_IMAGE" >/dev/null 2>&1 ||
    fail "The running image '$OLD_IMAGE' cannot be inspected."
  docker image tag "$OLD_IMAGE" "$ROLLBACK_IMAGE" ||
    fail "Could not create the temporary rollback image."
  HAD_OLD=1
fi
write_state "built"

if [ "$HAD_OLD" -eq 1 ]; then
  log "stop" "Stopping the existing service for the cold backup window."
  write_state "stopping"
  compose "$RELEASE_DIR" "$OLD_IMAGE" stop "$SERVICE" ||
    fail "Could not stop the existing service."
  write_state "stopped"
else
  log "stop" "No existing container was found; the persisted database will still be backed up."
  write_state "stopped"
fi

write_state "backing_up"
backup_database || fail "Cold database backup failed."
write_state "backed_up"

log "switch" "Replacing the single formal release directory."
write_state "swapping"
[ ! -e "$PREVIOUS_DIR" ] || fail "Previous directory already exists: $PREVIOUS_DIR"
if [ -e "$RELEASE_DIR" ]; then
  mv "$RELEASE_DIR" "$PREVIOUS_DIR" || fail "Could not preserve the previous release directory."
fi
mv "$INCOMING_DIR" "$RELEASE_DIR" || fail "Could not install the new formal release directory."
write_state "directories_swapped"

log "switch" "Starting the new SHA image with the existing named volume."
write_state "new_starting"
compose "$RELEASE_DIR" "$NEW_IMAGE" up -d --no-build --force-recreate "$SERVICE" ||
  fail "Could not start the new service."
write_state "new_started"

if ! wait_for_health "$RELEASE_DIR" "$NEW_IMAGE" "New service"; then
  fail "The new service did not pass its health check."
fi
write_state "healthy"

marker_tmp="$RELEASE_DIR/.release-sha.tmp.$TOKEN"
printf '%s\n' "$SHA" > "$marker_tmp"
mv -f "$marker_tmp" "$RELEASE_DIR/.release-sha"

log "cleanup" "Removing temporary release, rollback, upload, and lock state."
safe_remove_file "$BACKUP_TMP" "$BACKUP_DIR/.platform.sqlite.backup.$TOKEN.tmp" || true
if [ "$HAD_OLD" -eq 1 ]; then
  if [ "$OLD_IMAGE" != "$NEW_IMAGE" ]; then
    docker image rm "$OLD_IMAGE" >/dev/null 2>&1 ||
      fail "Could not remove the previous application image '$OLD_IMAGE'."
  fi
fi

write_state "committed"
if [ -d "$PREVIOUS_DIR" ]; then
  safe_remove_dir "$PREVIOUS_DIR" "${RELEASE_DIR}.previous.${TOKEN}" ||
    fail "Could not remove the previous release directory."
fi
if [ "$HAD_OLD" -eq 1 ]; then
  docker image rm "$ROLLBACK_IMAGE" >/dev/null 2>&1 ||
    fail "Could not remove the temporary rollback image."
fi
safe_remove_dir "$UPLOAD_DIR" "${RELEASE_DIR}.upload.${TOKEN}" ||
  fail "Could not remove the upload directory."
release_lock
SUCCESS=1

log "health" "Deployment succeeded: SHA=$SHA image=$NEW_IMAGE port=$PARTY_PORT health=healthy."
exit 0
