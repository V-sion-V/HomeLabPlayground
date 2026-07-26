import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const npmEntry = process.env.npm_execpath;
const temporaryRoot = mkdtempSync(join(tmpdir(), "home-table-e2e-"));
const databasePath = join(temporaryRoot, "platform.sqlite");
let server;
let serverOutput = "";

try {
  if (!npmEntry) throw new Error("npm_execpath is unavailable; run this script through npm");
  const buildStatus = await runCommand(process.execPath, [npmEntry, "run", "build"]);
  if (buildStatus !== 0) throw new Error(`Production build failed with exit code ${buildStatus}`);

  server = spawn(process.execPath, ["dist/server/index.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: "4173",
      HOST: "127.0.0.1",
      DATABASE_PATH: databasePath,
      STATIC_ROOT: resolve("dist/web"),
      NODE_ENV: "test"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  server.stdout.on("data", (chunk) => {
    serverOutput += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    serverOutput += chunk.toString();
  });

  await waitForServer("http://127.0.0.1:4173/healthz", 20_000);
  process.exitCode = await runCommand(
    process.execPath,
    [
      "node_modules/@playwright/test/cli.js",
      "test",
      "tests/e2e/core.spec.ts",
      "--reporter=line"
    ],
    "inherit"
  );
} catch (error) {
  console.error(error);
  if (serverOutput) console.error(serverOutput);
  process.exitCode = 1;
} finally {
  if (server) {
    server.kill("SIGTERM");
    await Promise.race([
      new Promise((resolveExit) => server.once("exit", resolveExit)),
      new Promise((resolveExit) => setTimeout(resolveExit, 3_000))
    ]);
    if (server.exitCode === null) server.kill("SIGKILL");
  }
  rmSync(temporaryRoot, { recursive: true, force: true });
}

async function waitForServer(url, timeout) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The production server is still starting.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`Production server did not become ready within ${timeout}ms`);
}

function runCommand(command, args, stdio = "inherit") {
  return new Promise((resolveExit, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      stdio
    });
    child.once("error", reject);
    child.once("exit", (code) => resolveExit(code ?? 1));
  });
}
