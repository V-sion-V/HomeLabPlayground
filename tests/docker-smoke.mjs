import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const suffix = randomUUID().slice(0, 8);
const image = `home-party-game-platform-smoke:${suffix}`;
const volume = `home-party-game-platform-smoke-${suffix}`;
const offlineContainer = `party-offline-${suffix}`;
const firstContainer = `party-first-${suffix}`;
const secondContainer = `party-second-${suffix}`;
const containers = [offlineContainer, firstContainer, secondContainer];

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
  const entered = await post(`${firstBase}/api/enter`, { username: "smoke-user", avatar: "🦊" });
  if (entered.status !== "accepted") throw new Error("Account entry was not accepted");
  const before = await get(`${firstBase}/api/state`);
  must(["rm", "-f", firstContainer]);

  must(["run", "-d", "--name", secondContainer, "-P", "-v", `${volume}:/data`, image]);
  await waitForHealth(secondContainer);
  const after = await get(`${baseUrl(secondContainer)}/api/state`);
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    throw new Error("State fingerprint changed across container restart");
  }
  console.log("Docker offline startup, health, named-volume persistence and restart fingerprint passed.");
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
  return `http://127.0.0.1:${port}`;
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
