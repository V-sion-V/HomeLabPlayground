import { spawn } from "node:child_process";

const vite = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--config", "apps/web/vite.config.ts"],
  { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] }
);

let viteOutput = "";
vite.stdout.on("data", (chunk) => {
  viteOutput += chunk.toString();
});
vite.stderr.on("data", (chunk) => {
  viteOutput += chunk.toString();
});

try {
  await waitForServer("http://127.0.0.1:4173", 15_000);
  const status = await runPlaywright();
  process.exitCode = status;
} catch (error) {
  console.error(error);
  if (viteOutput) console.error(viteOutput);
  process.exitCode = 1;
} finally {
  vite.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => vite.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 3_000))
  ]);
  if (vite.exitCode === null) vite.kill("SIGKILL");
}

async function waitForServer(url, timeout) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Vite did not become ready within ${timeout}ms`);
}

function runPlaywright() {
  return new Promise((resolve, reject) => {
    const runner = spawn(
      process.execPath,
      [
        "node_modules/@playwright/test/cli.js",
        "test",
        "tests/e2e/core.spec.ts",
        "--reporter=line"
      ],
      { cwd: process.cwd(), stdio: "inherit" }
    );
    runner.once("error", reject);
    runner.once("exit", (code) => resolve(code ?? 1));
  });
}
