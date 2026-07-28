import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const suffix = randomUUID().slice(0, 8);
const image = `home-party-game-platform-smoke:${suffix}`;
const volume = `home-party-game-platform-smoke-${suffix}`;
const offlineContainer = `party-offline-${suffix}`;
const firstContainer = `party-first-${suffix}`;
const secondContainer = `party-second-${suffix}`;
const containers = [offlineContainer, firstContainer, secondContainer];
const smokeHost = process.env.DOCKER_SMOKE_HOST?.trim() || "127.0.0.1";

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

  must(["run", "-d", "--name", firstContainer, "-P", "-v", `${volume}:/data`, image]);
  await waitForHealth(firstContainer);
  const firstBase = baseUrl(firstContainer);
  const alice = await post(`${firstBase}/api/enter`, {
    username: `smoke-alice-${suffix}`,
    avatar: "🦊"
  });
  const bob = await post(`${firstBase}/api/enter`, {
    username: `smoke-bob-${suffix}`,
    avatar: "🐼"
  });
  if (alice.status !== "accepted" || bob.status !== "accepted") {
    throw new Error("Account entry was not accepted");
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

  must(["run", "-d", "--name", secondContainer, "-P", "-v", `${volume}:/data`, image]);
  await waitForHealth(secondContainer);
  const secondBase = baseUrl(secondContainer);
  const afterLobby = await get(`${secondBase}/api/state`);
  const afterRoom = await get(`${secondBase}/api/room/${roomId}?display=1`);
  const afterPrivate = await get(
    `${secondBase}/api/room/${roomId}?accountId=${alice.data.account.id}` +
      `&connectionId=${encodeURIComponent(alice.data.connectionId)}`
  );
  if (
    JSON.stringify(durableLobby(beforeLobby)) !==
      JSON.stringify(durableLobby(afterLobby)) ||
    JSON.stringify(durableRoom(beforeRoom)) !==
      JSON.stringify(durableRoom(afterRoom)) ||
    JSON.stringify(beforePrivate.ownHoleCards) !==
      JSON.stringify(afterPrivate.ownHoleCards)
  ) {
    throw new Error("Durable state or private cards changed across container restart");
  }
  if (!afterRoom.seats.every((seat) => seat.connected === false)) {
    throw new Error("Persisted connections were not rebuilt as disconnected");
  }
  console.log(
    "Docker offline startup, non-root runtime, health, named-volume poker persistence and restart fingerprint passed."
  );
} finally {
  for (const container of containers) run(["rm", "-f", container], false);
  run(["volume", "rm", volume], false);
  run(["image", "rm", image], false);
}

function run(args, inherit = true) {
  return spawnSync("docker", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: inherit ? "inherit" : "pipe"
  });
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
    advanceDeadline: undefined,
    seats: room.seats.map((seat) => ({ ...seat, connected: undefined })),
    ownHoleCards: undefined
  };
}
