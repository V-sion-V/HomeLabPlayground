import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { isDeepStrictEqual } from "node:util";

const suffix = randomUUID().slice(0, 8);
const image = `home-party-game-platform-smoke:${suffix}`;
const volume = `home-party-game-platform-smoke-${suffix}`;
const offlineContainer = `party-offline-${suffix}`;
const firstContainer = `party-first-${suffix}`;
const secondContainer = `party-second-${suffix}`;
const thirdContainer = `party-third-${suffix}`;
const containers = [
  offlineContainer,
  firstContainer,
  secondContainer,
  thirdContainer
];
const smokeHost = process.env.DOCKER_SMOKE_HOST?.trim() || "127.0.0.1";
const dockerSshTarget = process.env.DOCKER_SSH_TARGET?.trim();
const dockerSshPort = process.env.DOCKER_SSH_PORT?.trim() || "22";
const dockerSshIdentity = process.env.DOCKER_SSH_IDENTITY?.trim();
const dockerSshWorkdir = process.env.DOCKER_SSH_WORKDIR?.trim();

const dockerCheck = run(["version", "--format", "{{.Server.Version}}"], false);
if (dockerCheck.status !== 0) {
  console.error("Docker CLI/daemon is required for test:docker-smoke.");
  process.exit(2);
}

try {
  must(["build", "--platform", "linux/amd64", "-t", image, "."]);
  must(["volume", "create", volume]);

  must([
    "run",
    "-d",
    "--name",
    offlineContainer,
    "--network",
    "none",
    "-v",
    `${volume}:/data`,
    image
  ]);
  await waitForHealth(offlineContainer);
  const uid = run(["exec", offlineContainer, "id", "-u"], false);
  if (uid.status !== 0 || uid.stdout.trim() === "0") {
    throw new Error("Runtime container must use a non-root user");
  }
  must([
    "exec",
    offlineContainer,
    "node",
    "-e",
    "fetch('http://127.0.0.1:3000/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
  ]);
  must(["rm", "-f", offlineContainer]);
  must([
    "run",
    "--rm",
    "--network",
    "none",
    "-v",
    `${volume}:/data`,
    "--entrypoint",
    "node",
    image,
    "--input-type=module",
    "-e",
    "import Database from 'better-sqlite3';const db=new Database('/data/platform.sqlite');const row=db.prepare('SELECT state_json FROM platform_state WHERE id=1').get();const state=JSON.parse(row.state_json);delete state.retiredIdentities;db.prepare('UPDATE platform_state SET state_json=? WHERE id=1').run(JSON.stringify(state));db.close();"
  ]);

  must(["run", "-d", "--name", firstContainer, "-P", "-v", `${volume}:/data`, image]);
  await waitForHealth(firstContainer);
  must([
    "exec",
    firstContainer,
    "node",
    "--input-type=module",
    "-e",
    "import Database from 'better-sqlite3';const db=new Database('/data/platform.sqlite',{readonly:true});const row=db.prepare('SELECT state_json FROM platform_state WHERE id=1').get();const state=JSON.parse(row.state_json);db.close();if(!state.retiredIdentities)process.exit(1);"
  ]);
  const firstBase = baseUrl(firstContainer);
  const alice = await post(`${firstBase}/api/register`, {
    commandId: randomUUID(),
    username: `smoke-alice-${suffix}`,
    avatar: "🦊",
    language: "zh-CN",
    theme: "dark"
  });
  const bob = await post(`${firstBase}/api/register`, {
    commandId: randomUUID(),
    username: `smoke-bob-${suffix}`,
    avatar: "🐼",
    language: "zh-CN",
    theme: "dark"
  });
  if (
    alice.status !== "accepted" ||
    bob.status !== "accepted" ||
    alice.data.account.volume !== 100 ||
    bob.data.account.volume !== 100
  ) {
    throw new Error("Create-only account registration was not accepted");
  }
  const create = await post(`${firstBase}/api/command`, {
    commandId: randomUUID(),
    connectionId: alice.data.connectionId,
    aggregateId: "platform",
    expectedVersion: bob.version,
    type: "room.create",
    payload: {
      accountId: alice.data.account.id,
      name: "Docker recovery table",
      config: {
        mode: "chips-and-cards",
        smallBlind: 50,
        bigBlind: 100,
        minBuyIn: 2_000,
        maxBuyIn: 20_000,
        hostTransferTimeoutSeconds: 60
      },
      buyIn: 2_000
    }
  });
  const roomId = create.data?.id;
  if (create.status !== "accepted" || !roomId) {
    throw new Error("Room creation was not accepted");
  }
  const join = await post(`${firstBase}/api/command`, {
    commandId: randomUUID(),
    connectionId: bob.data.connectionId,
    aggregateId: roomId,
    expectedVersion: create.version,
    type: "room.join",
    payload: {
      accountId: bob.data.account.id,
      roomId,
      buyIn: 2_000
    }
  });
  const ready = await post(`${firstBase}/api/command`, {
    commandId: randomUUID(),
    connectionId: bob.data.connectionId,
    aggregateId: roomId,
    expectedVersion: join.version,
    type: "poker.ready",
    payload: {
      accountId: bob.data.account.id,
      roomId,
      ready: true
    }
  });
  const start = await post(`${firstBase}/api/command`, {
    commandId: randomUUID(),
    connectionId: alice.data.connectionId,
    aggregateId: roomId,
    expectedVersion: ready.version,
    type: "room.start",
    payload: { accountId: alice.data.account.id, roomId }
  });
  const action = await post(`${firstBase}/api/command`, {
    commandId: randomUUID(),
    connectionId: alice.data.connectionId,
    aggregateId: roomId,
    expectedVersion: start.version,
    type: "poker.action",
    payload: {
      accountId: alice.data.account.id,
      roomId,
      pokerVersion: start.data.pokerVersion,
      action: { kind: "call" }
    }
  });
  if (action.status !== "accepted") throw new Error("Poker action was not accepted");
  const beforeLobby = await get(`${firstBase}/api/state`);
  const beforeRoom = await get(`${firstBase}/api/room/${roomId}?display=1`);
  const beforePrivate = await get(
    `${firstBase}/api/room/${roomId}?accountId=${alice.data.account.id}` +
      `&connectionId=${encodeURIComponent(alice.data.connectionId)}`
  );
  must(["rm", "-f", firstContainer]);
  must([
    "run",
    "--rm",
    "--network",
    "none",
    "-v",
    `${volume}:/data`,
    "--entrypoint",
    "node",
    image,
    "--input-type=module",
    "-e",
    "import Database from 'better-sqlite3';const db=new Database('/data/platform.sqlite');const row=db.prepare('SELECT state_json FROM platform_state WHERE id=1').get();const state=JSON.parse(row.state_json);delete state.settings.defaultTheme;for(const account of Object.values(state.accounts)){delete account.language;delete account.theme;delete account.volume;}db.prepare('UPDATE platform_state SET state_json=? WHERE id=1').run(JSON.stringify(state));db.close();"
  ]);

  must(["run", "-d", "--name", secondContainer, "-P", "-v", `${volume}:/data`, image]);
  await waitForHealth(secondContainer);
  const secondBase = baseUrl(secondContainer);
  const afterLobby = await get(`${secondBase}/api/state`);
  const afterAdmin = await get(`${secondBase}/api/admin/state`);
  const afterRoom = await get(`${secondBase}/api/room/${roomId}?display=1`);
  const staleLease = await fetch(
    `${secondBase}/api/state?accountId=${alice.data.account.id}` +
      `&connectionId=${encodeURIComponent(alice.data.connectionId)}`
  );
  if (
    !isDeepStrictEqual(durableLobby(beforeLobby), durableLobby(afterLobby)) ||
    !isDeepStrictEqual(durableRoom(beforeRoom), durableRoom(afterRoom))
  ) {
    throw new Error(
      "Durable public state changed across legacy preference recovery: " +
        JSON.stringify({
          beforeLobby: durableLobby(beforeLobby),
          afterLobby: durableLobby(afterLobby),
          beforeRoom: durableRoom(beforeRoom),
          afterRoom: durableRoom(afterRoom)
        })
    );
  }
  if (
    afterAdmin.settings.defaultTheme !== "dark" ||
    JSON.stringify(afterAdmin).includes("connectionId") ||
    JSON.stringify(afterAdmin).includes("holeCards") ||
    JSON.stringify(afterAdmin).includes("retiredIdentities")
  ) {
    throw new Error("Admin projection recovery or privacy boundary was invalid");
  }
  if (staleLease.status !== 403) {
    throw new Error("A pre-restart control lease remained valid");
  }
  if (!afterRoom.seats.every((seat) => seat.connected === false)) {
    throw new Error("Persisted connections were not rebuilt as disconnected");
  }
  if (!Array.isArray(beforePrivate.ownHoleCards)) {
    throw new Error("Private-card persistence setup did not produce a private projection");
  }
  const aliceReentry = await post(`${secondBase}/api/enter`, {
    commandId: randomUUID(),
    username: `smoke-alice-${suffix}`
  });
  const afterPrivate = await get(
    `${secondBase}/api/room/${roomId}?accountId=${alice.data.account.id}` +
      `&connectionId=${encodeURIComponent(aliceReentry.data.connectionId)}`
  );
  if (
    JSON.stringify(beforePrivate.ownHoleCards) !==
    JSON.stringify(afterPrivate.ownHoleCards)
  ) {
    throw new Error("Private cards changed across legacy preference recovery");
  }
  const bobReentry = await post(`${secondBase}/api/enter`, {
    commandId: randomUUID(),
    username: `smoke-bob-${suffix}`
  });
  if (
    [aliceReentry.data.account, bobReentry.data.account].some(
      (account) =>
        account.language !== "zh-CN" ||
        account.theme !== "dark" ||
        account.volume !== 100
    )
  ) {
    throw new Error("Legacy account preference defaults were not restored");
  }
  const deletion = await post(`${secondBase}/api/admin/command`, {
    commandId: randomUUID(),
    aggregateId: "platform",
    expectedVersion: bobReentry.version,
    type: "admin.accounts.delete",
    payload: {
      accountIds: [bob.data.account.id]
    }
  });
  if (
    deletion.status !== "accepted" ||
    deletion.data?.deletedIds?.[0] !== bob.data.account.id
  ) {
    throw new Error("Account deletion was not accepted");
  }
  const deletedLobby = await get(
    `${secondBase}/api/state?accountId=${alice.data.account.id}` +
      `&connectionId=${encodeURIComponent(aliceReentry.data.connectionId)}`
  );
  const deletedLease = await fetch(
    `${secondBase}/api/state?accountId=${bob.data.account.id}` +
      `&connectionId=${encodeURIComponent(bobReentry.data.connectionId)}`
  );
  if (
    deletedLobby.accounts.some((account) => account.id === bob.data.account.id) ||
    JSON.stringify(deletedLobby).includes("retiredIdentities") ||
    JSON.stringify(deletedLobby).includes(`smoke-bob-${suffix}`) ||
    deletedLease.status !== 403
  ) {
    throw new Error("Deleted account, lease or internal retirement data remained active");
  }
  const replacement = await post(`${secondBase}/api/register`, {
    commandId: randomUUID(),
    username: `smoke-bob-${suffix}`,
    avatar: "🐼",
    language: "en",
    theme: "light"
  });
  if (
    replacement.status !== "accepted" ||
    replacement.data.account.id === bob.data.account.id
  ) {
    throw new Error("Deleted username was not recreated as an independent account");
  }
  must(["rm", "-f", secondContainer]);

  must(["run", "-d", "--name", thirdContainer, "-P", "-v", `${volume}:/data`, image]);
  await waitForHealth(thirdContainer);
  const thirdBase = baseUrl(thirdContainer);
  const restartedLobby = await get(`${thirdBase}/api/state`);
  const replacementStaleLease = await fetch(
    `${thirdBase}/api/state?accountId=${replacement.data.account.id}` +
      `&connectionId=${encodeURIComponent(replacement.data.connectionId)}`
  );
  if (
    restartedLobby.accounts.some((account) => account.id === bob.data.account.id) ||
    !restartedLobby.accounts.some(
      (account) => account.id === replacement.data.account.id
    ) ||
    JSON.stringify(restartedLobby).includes(`"${bob.data.account.id}"`) ||
    replacementStaleLease.status !== 403
  ) {
    throw new Error("Deleted identity reappeared or replacement identity changed after restart");
  }
  console.log(
    "Docker offline startup, non-root runtime, health, legacy preference recovery, named-volume poker/private-card persistence, admin deletion, lease invalidation, username reuse and restart recovery passed."
  );
} finally {
  for (const container of containers) run(["rm", "-f", container], false);
  run(["volume", "rm", volume], false);
  run(["image", "rm", image], false);
}

function run(args, inherit = true) {
  const command = dockerSshTarget ? "ssh" : "docker";
  const commandArgs = dockerSshTarget
    ? [
        "-p",
        dockerSshPort,
        "-o",
        "BatchMode=yes",
        "-o",
        "ConnectTimeout=10",
        ...(dockerSshIdentity ? ["-i", dockerSshIdentity] : []),
        dockerSshTarget,
        `${dockerSshWorkdir ? `cd ${quotePosix(dockerSshWorkdir)} && ` : ""}` +
          `docker ${args.map(quotePosix).join(" ")}`
      ]
    : args;
  return spawnSync(command, commandArgs, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: inherit ? "inherit" : "pipe"
  });
}

function quotePosix(value) {
  return `'${String(value).replaceAll("'", `'"'"'`)}'`;
}

function must(args) {
  const result = run(args);
  if (result.status !== 0) throw new Error(`docker ${args.join(" ")} failed`);
}

async function waitForHealth(container) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const result = run(
      ["inspect", "--format", "{{.State.Health.Status}}", container],
      false
    );
    if (result.stdout.trim() === "healthy") return;
    if (result.stdout.trim() === "unhealthy") {
      throw new Error(`${container} became unhealthy`);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${container} did not become healthy`);
}

function baseUrl(container) {
  const result = run(["port", container, "3000/tcp"], false);
  if (result.status !== 0) throw new Error(`Could not resolve published port for ${container}`);
  const value = result.stdout.trim().split("\n")[0]?.trim();
  const port = value?.match(/:(\d+)$/)?.[1];
  if (!port) throw new Error(`Unexpected docker port output: ${value}`);
  const host = smokeHost.includes(":") && !smokeHost.startsWith("[")
    ? `[${smokeHost}]`
    : smokeHost;
  return `http://${host}:${port}`;
}

async function get(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

async function post(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

function durableLobby(lobby) {
  return {
    ...lobby,
    version: undefined,
    rooms: lobby.rooms.map((room) => ({
      ...room,
      seats: room.seats.map((seat) => ({ ...seat, connected: undefined }))
    }))
  };
}

function durableRoom(room) {
  return {
    ...room,
    platformVersion: undefined,
    version: undefined,
    pokerVersion: undefined,
    advanceDeadline: undefined,
    readyAccountIds: undefined,
    seats: room.seats.map((seat) => ({ ...seat, connected: undefined })),
    ownHoleCards: undefined
  };
}
