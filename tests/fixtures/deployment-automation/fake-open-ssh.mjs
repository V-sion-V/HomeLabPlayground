import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync
} from "node:fs";
import { basename, join } from "node:path";

const tool = process.argv[2];
const args = process.argv.slice(3);
const logPath = process.env.FAKE_OPENSSH_LOG;
const behavior = process.env.FAKE_OPENSSH_BEHAVIOR ?? "deploy";
const captureDirectory = process.env.FAKE_SCP_CAPTURE;

if (!logPath) {
  console.error("FAKE_OPENSSH_LOG is required");
  process.exit(90);
}

const priorEvents = existsSync(logPath)
  ? readFileSync(logPath, "utf8").split(/\r?\n/).filter(Boolean).length
  : 0;
appendFileSync(logPath, `${JSON.stringify({ tool, args })}\n`, "utf8");

if (tool === "ssh") {
  const remoteCommand = args.join(" ");
  if (priorEvents === 0) {
    if (behavior === "probe-fail") {
      console.error("simulated SSH preflight failure");
      process.exit(41);
    }
    console.log(behavior === "noop" ? "NOOP" : "DEPLOY");
    process.exit(0);
  }

  if (remoteCommand.includes('mkdir "$upload"')) {
    process.exit(0);
  }

  if (remoteCommand.includes("remote-deploy.sh") || priorEvents >= 3) {
    if (behavior === "remote-fail") {
      console.error("[rollback] simulated remote failure; previous state restored");
      process.exit(42);
    }
    console.log("[health] simulated remote deployment succeeded");
    process.exit(0);
  }

  process.exit(0);
}

if (tool === "scp") {
  if (behavior === "scp-fail") {
    console.error("simulated SCP failure");
    process.exit(43);
  }
  if (captureDirectory) {
    mkdirSync(captureDirectory, { recursive: true });
    for (const source of scpSources(args)) {
      if (existsSync(source)) {
        copyFileSync(source, join(captureDirectory, basename(source)));
      }
    }
  }
  process.exit(0);
}

console.error(`Unknown fake OpenSSH tool: ${tool}`);
process.exit(91);

function scpSources(values) {
  const positional = [];
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (["-P", "-o", "-i"].includes(value)) {
      index += 1;
      continue;
    }
    if (value.startsWith("-")) continue;
    positional.push(value);
  }
  return positional.slice(0, -1);
}
