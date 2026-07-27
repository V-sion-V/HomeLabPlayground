import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const repositoryRoot = process.cwd();
const powershell = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";
const bash = "C:\\Program Files\\Git\\bin\\bash.exe";
const remoteScriptSource = resolve(repositoryRoot, "deploy/remote-deploy.sh");
const composeSource = resolve(repositoryRoot, "deploy/compose.yml");
const deployScriptSource = resolve(repositoryRoot, "deploy/deploy.ps1");
const dockerfileSource = resolve(repositoryRoot, "Dockerfile");
const fakeOpenSshSource = resolve(
  repositoryRoot,
  "tests/fixtures/deployment-automation/fake-open-ssh.mjs"
);
const fakeDockerSource = resolve(
  repositoryRoot,
  "tests/fixtures/deployment-automation/fake-docker.mjs"
);
const nativeSshProbeSource = String.raw`
using System;
using System.IO;
using System.Linq;
using System.Text;

public static class Program
{
    private static string Json(string value)
    {
        return "\"" + value
            .Replace("\\", "\\\\")
            .Replace("\"", "\\\"")
            .Replace("\r", "\\r")
            .Replace("\n", "\\n")
            .Replace("\t", "\\t") + "\"";
    }

    public static int Main(string[] args)
    {
        var logPath = Environment.GetEnvironmentVariable("FAKE_OPENSSH_LOG");
        if (String.IsNullOrEmpty(logPath))
        {
            Console.Error.WriteLine("FAKE_OPENSSH_LOG is required");
            return 90;
        }

        var tool = Path.GetFileNameWithoutExtension(
            Environment.GetCommandLineArgs()[0]
        ).ToLowerInvariant();
        var payload = "{\"tool\":" + Json(tool) + ",\"args\":[" +
            String.Join(",", args.Select(Json)) + "]}";
        File.AppendAllText(
            logPath,
            payload + Environment.NewLine,
            new UTF8Encoding(false)
        );

        if (tool != "ssh")
        {
            Console.Error.WriteLine("Unexpected native probe tool: " + tool);
            return 91;
        }

        var behavior = Environment.GetEnvironmentVariable("FAKE_OPENSSH_BEHAVIOR");
        if (behavior == "probe-fail")
        {
            Console.Error.WriteLine("simulated SSH preflight failure");
            return 41;
        }

        var remoteCommand = args.Length == 0 ? "" : args[args.Length - 1];
        if (behavior == "noop")
        {
            if (remoteCommand.Contains("printf NOOP\\n"))
            {
                Console.WriteLine("NOOPn");
            }
            else if (remoteCommand.Contains("printf NOOP"))
            {
                Console.WriteLine("NOOP");
            }
            else
            {
                Console.WriteLine("DEPLOY");
            }
        }
        else
        {
            Console.WriteLine("DEPLOY");
        }
        return 0;
    }
}
`;
const temporaryRoots = new Set<string>();

afterEach(() => {
  for (const root of temporaryRoots) {
    rmSync(root, { recursive: true, force: true });
  }
  temporaryRoots.clear();
});

describe("deployment automation local orchestrator", () => {
  it("rejects a dirty workspace before resolving any remote side effect", () => {
    const fixture = createLocalRepository();
    writeFileSync(join(fixture.repository, "dirty.txt"), "not committed", "utf8");

    const result = runLocalDeploy(fixture, "deploy");

    expect(result.status).toBe(1);
    expect(result.output.replace(/\s+/g, "")).toContain("Gitworkspaceisnotclean");
    expect(existsSync(fixture.openSshLog)).toBe(false);
  });

  it("uses system OpenSSH options and returns a zero-upload no-op", () => {
    const fixture = createLocalRepository();

    const passwordMode = runLocalDeploy(fixture, "noop");
    expect(passwordMode.status, passwordMode.output).toBe(0);
    let events = readJsonLines(fixture.openSshLog);
    expect(passwordMode.output, JSON.stringify(events)).toContain(
      "deployment is a no-op"
    );
    expect(events).toHaveLength(1);
    expect(events[0]?.tool).toBe("ssh");
    expect(events[0]?.args).not.toContain("-i");
    expect(JSON.stringify(events)).not.toContain("BatchMode");
    expect(JSON.stringify(events)).not.toContain("StrictHostKeyChecking");
    expect(events.some((event) => event.tool === "scp")).toBe(false);
    expect(existsSync(fixture.scpCapture)).toBe(false);

    writeFileSync(fixture.openSshLog, "", "utf8");
    const identity = join(fixture.root, "test identity");
    writeFileSync(identity, "fake private key path only", "utf8");
    const keyMode = runLocalDeploy(fixture, "noop", identity);
    expect(keyMode.status, keyMode.output).toBe(0);
    events = readJsonLines(fixture.openSshLog);
    expect(events[0]?.args).toContain("-i");
    expect(events[0]?.args).toContain(identity);
    expect(JSON.stringify(events)).not.toContain("fake private key path only");
  });

  it("keeps probe tokens exact across the Windows native process boundary", () => {
    const fixture = createLocalRepository();
    compileNativeSshProbe(join(fixture.fakeBin, "ssh.exe"));

    const result = runLocalDeploy(fixture, "noop");

    expect(result.status, result.output).toBe(0);
    expect(result.output).toContain("deployment is a no-op");
    const events = readJsonLines(fixture.openSshLog);
    expect(events).toHaveLength(1);
    const probeCommand = events[0]?.args.at(-1);
    expect(probeCommand).toContain("printf NOOP");
    expect(probeCommand).not.toContain("printf NOOP\\n");
    expect(probeCommand).toContain("printf DEPLOY");
    expect(probeCommand).not.toContain("printf DEPLOY\\n");
    expect(events.some((event) => event.tool === "scp")).toBe(false);
    expect(existsSync(fixture.scpCapture)).toBe(false);
  });

  it("uses the official Node image headers for native dependency builds", () => {
    const dockerfile = readFileSync(dockerfileSource, "utf8");
    const headerConfiguration = dockerfile.indexOf(
      "ENV npm_config_nodedir=/usr/local"
    );
    const dependencyInstall = dockerfile.indexOf("RUN npm ci");

    expect(headerConfiguration).toBeGreaterThan(-1);
    expect(dependencyInstall).toBeGreaterThan(headerConfiguration);
  });

  it("uploads only committed HEAD artifacts and preserves remote failure exit status", () => {
    const fixture = createLocalRepository();
    const success = runLocalDeploy(fixture, "deploy");

    expect(success.status, success.output).toBe(0);
    let events = readJsonLines(fixture.openSshLog);
    expect(events.map((event) => event.tool)).toEqual([
      "ssh",
      "ssh",
      "scp",
      "ssh"
    ]);
    const capturedArchive = join(fixture.scpCapture, "source.tar.gz");
    const capturedScript = join(fixture.scpCapture, "remote-deploy.sh");
    expect(existsSync(capturedArchive)).toBe(true);
    expect(existsSync(capturedScript)).toBe(true);
    expect(readFileSync(capturedScript, "utf8")).toBe(
      readFileSync(join(fixture.repository, "deploy/remote-deploy.sh"), "utf8")
    );
    const entries = listTar(capturedArchive);
    expect(entries).toContain("deploy/deploy.ps1");
    expect(entries).toContain("deploy/remote-deploy.sh");
    expect(
      entries.some((entry) => entry === ".git" || entry.startsWith(".git/"))
    ).toBe(false);
    expect(entries.some((entry) => entry.includes("deploy.config.psd1"))).toBe(false);

    writeFileSync(fixture.openSshLog, "", "utf8");
    rmSync(fixture.scpCapture, { recursive: true, force: true });
    const failed = runLocalDeploy(fixture, "remote-fail");
    expect(failed.status).toBe(1);
    expect(failed.output.replace(/\s+/g, "")).toContain(
      "Remotedeploymentfailedwithexitcode42"
    );
    events = readJsonLines(fixture.openSshLog);
    expect(events.some((event) => event.tool === "scp")).toBe(true);
  });
});

describe("deployment automation remote integrity and deployment decision", () => {
  it("rejects an archive hash mismatch before extraction or build", () => {
    const fixture = createRemoteScenario();
    fixture.archiveHash = "0".repeat(64);
    const backupBefore = readFileSync(
      join(fixture.backupDir, "platform.sqlite.backup")
    );

    const result = runRemoteDeploy(fixture);

    expect(result.status).not.toBe(0);
    expect(result.output).toContain("Source archive integrity check failed");
    const state = readDockerState(fixture);
    expect(state.events).not.toContain("compose:build");
    expect(state.events).not.toContain("compose:stop");
    expect(state.service.image).toBe(fixture.oldImage);
    expect(readFileSync(join(fixture.backupDir, "platform.sqlite.backup"))).toEqual(
      backupBefore
    );
    expect(existsSync(fixture.uploadDir)).toBe(false);
    expect(existsSync(fixture.lockDir)).toBe(false);
  });

  it("rejects a remote script hash mismatch before taking the deployment lock", () => {
    const fixture = createRemoteScenario();
    fixture.scriptHash = "0".repeat(64);

    const result = runRemoteDeploy(fixture);

    expect(result.status).not.toBe(0);
    expect(result.output).toContain("Remote script integrity check failed");
    expect(readDockerState(fixture).events).toEqual([]);
    expect(existsSync(fixture.uploadDir)).toBe(false);
    expect(existsSync(fixture.lockDir)).toBe(false);
  });

  it("does not no-op when the marker matches but the running image does not", () => {
    const targetSha = "6".repeat(40);
    const fixture = createRemoteScenario({
      targetSha,
      markerSha: targetSha
    });

    const result = runRemoteDeploy(fixture);

    expect(result.status, result.output).toBe(0);
    const state = readDockerState(fixture);
    expect(state.events).toContain("compose:build");
    expect(state.events).toContain("compose:stop");
    expect(state.events).toContain("docker:run:backup");
    expect(state.service.image).toBe(fixture.newImage);
  });

  it("does not no-op when the SHA image is running but unhealthy", () => {
    const targetSha = "7".repeat(40);
    const matchingImage = `home-party-game-platform:${targetSha}`;
    const fixture = createRemoteScenario({
      targetSha,
      markerSha: targetSha,
      oldImage: matchingImage,
      initialHealth: "unhealthy"
    });

    const result = runRemoteDeploy(fixture);

    expect(result.status, result.output).toBe(0);
    const state = readDockerState(fixture);
    expect(state.events).toContain("compose:build");
    expect(state.events).toContain("compose:stop");
    expect(state.events).toContain("docker:run:backup");
    expect(state.service.image).toBe(fixture.newImage);
    expect(state.service.health).toBe("healthy");
  });
});

describe("deployment automation remote state machine pre-cutover", () => {
  it("builds before stop, atomically replaces the single backup, and cleans success state", () => {
    const fixture = createRemoteScenario();
    const result = runRemoteDeploy(fixture);

    expect(result.status, result.output).toBe(0);
    expect(result.output).toContain("Deployment succeeded");
    expect(readFileSync(join(fixture.releaseDir, ".release-sha"), "utf8").trim()).toBe(
      fixture.targetSha
    );
    expect(readFileSync(join(fixture.releaseDir, "version.txt"), "utf8")).toBe("new");
    expect(readFileSync(join(fixture.backupDir, "platform.sqlite.backup"))).toEqual(
      fixture.preDeploymentDatabase
    );
    expect(existsSync(fixture.uploadDir)).toBe(false);
    expect(existsSync(fixture.incomingDir)).toBe(false);
    expect(existsSync(fixture.previousDir)).toBe(false);
    expect(existsSync(fixture.lockDir), result.output).toBe(false);

    const state = readDockerState(fixture);
    expect(state.service.image).toBe(fixture.newImage);
    expect(state.service.health).toBe("healthy");
    expect(Object.keys(state.images)).toEqual([fixture.newImage]);
    expect(indexOfEvent(state.events, "compose:build")).toBeLessThan(
      indexOfEvent(state.events, "compose:stop")
    );
    expect(indexOfEvent(state.events, "compose:stop")).toBeLessThan(
      indexOfEvent(state.events, "docker:run:backup")
    );
    expect(indexOfEvent(state.events, "docker:run:backup")).toBeLessThan(
      indexOfEventPrefix(state.events, "compose:up:")
    );
  });

  it("authoritatively no-ops without build, stop, backup, swap, or restart", () => {
    const targetSha = "c".repeat(40);
    const newImage = `home-party-game-platform:${targetSha}`;
    const fixture = createRemoteScenario({
      targetSha,
      markerSha: targetSha,
      oldImage: newImage
    });
    const databaseBefore = readFileSync(join(fixture.volumeDir, "platform.sqlite"));
    const backupBefore = readFileSync(
      join(fixture.backupDir, "platform.sqlite.backup")
    );

    const result = runRemoteDeploy(fixture);

    expect(result.status, result.output).toBe(0);
    expect(result.output).toContain("no upload content will be applied");
    const state = readDockerState(fixture);
    expect(state.events.some((event) => event === "compose:build")).toBe(false);
    expect(state.events.some((event) => event === "compose:stop")).toBe(false);
    expect(state.events.some((event) => event === "docker:run:backup")).toBe(false);
    expect(state.events.some((event) => event.startsWith("compose:up:"))).toBe(false);
    expect(readFileSync(join(fixture.volumeDir, "platform.sqlite"))).toEqual(
      databaseBefore
    );
    expect(readFileSync(join(fixture.backupDir, "platform.sqlite.backup"))).toEqual(
      backupBefore
    );
    expect(existsSync(fixture.uploadDir)).toBe(false);
    expect(existsSync(fixture.lockDir), result.output).toBe(false);
  });

  it("keeps the old service and backup untouched when build fails", () => {
    const fixture = createRemoteScenario({ failures: ["build"] });
    const backupBefore = readFileSync(
      join(fixture.backupDir, "platform.sqlite.backup")
    );
    const result = runRemoteDeploy(fixture);

    expect(result.status).not.toBe(0);
    const state = readDockerState(fixture);
    expect(state.service.running).toBe(true);
    expect(state.service.image).toBe(fixture.oldImage);
    expect(state.events).toContain("compose:build");
    expect(state.events).not.toContain("compose:stop");
    expect(readFileSync(join(fixture.backupDir, "platform.sqlite.backup"))).toEqual(
      backupBefore
    );
    expect(readFileSync(join(fixture.releaseDir, "version.txt"), "utf8")).toBe("old");
    expect(existsSync(fixture.lockDir), result.output).toBe(false);
  });

  it("restarts the old service and preserves the previous backup when cold backup fails", () => {
    const fixture = createRemoteScenario({ failures: ["backup"] });
    const backupBefore = readFileSync(
      join(fixture.backupDir, "platform.sqlite.backup")
    );
    const result = runRemoteDeploy(fixture);

    expect(result.status).not.toBe(0);
    const state = readDockerState(fixture);
    expect(state.events).toContain("compose:stop");
    expect(state.events).toContain("docker:run:backup");
    expect(state.events).toContain("compose:start");
    expect(state.service.running).toBe(true);
    expect(state.service.health).toBe("healthy");
    expect(readFileSync(join(fixture.backupDir, "platform.sqlite.backup"))).toEqual(
      backupBefore
    );
    expect(readFileSync(join(fixture.releaseDir, "version.txt"), "utf8")).toBe("old");
    expect(existsSync(fixture.lockDir), result.output).toBe(false);
  });
});

describe("deployment automation remote state machine recovery", () => {
  it("restores the old image and pre-deployment database after new health failure", () => {
    const fixture = createRemoteScenario({
      failures: ["new-health"],
      mutateDatabaseOnNewStart: true
    });
    const result = runRemoteDeploy(fixture);

    expect(result.status).not.toBe(0);
    expect(result.output).toContain("previous safe state was restored");
    const state = readDockerState(fixture);
    expect(state.events).toContain("database:mutated-by-new-service");
    expect(state.events).toContain("docker:run:restore");
    expect(state.service.image).toBe(fixture.oldImage);
    expect(state.service.health).toBe("healthy");
    expect(readFileSync(join(fixture.releaseDir, "version.txt"), "utf8")).toBe("old");
    expect(readFileSync(join(fixture.volumeDir, "platform.sqlite"))).toEqual(
      fixture.preDeploymentDatabase
    );
    expect(existsSync(join(fixture.volumeDir, "platform.sqlite-wal"))).toBe(false);
    expect(existsSync(join(fixture.volumeDir, "platform.sqlite-shm"))).toBe(false);
    expect(existsSync(fixture.lockDir)).toBe(false);
    expect(existsSync(fixture.previousDir)).toBe(false);
  });

  it("preserves the volume, backup, recovery lock, and manual commands if rollback health fails", () => {
    const fixture = createRemoteScenario({
      failures: ["new-health", "old-health"],
      mutateDatabaseOnNewStart: true
    });
    const result = runRemoteDeploy(fixture);

    expect(result.status).not.toBe(0);
    expect(result.output).toContain("Automatic recovery failed");
    expect(result.output).toContain("docker compose logs home-table");
    expect(result.output).toContain(toPosix(fixture.backupDir));
    expect(existsSync(join(fixture.volumeDir, "platform.sqlite"))).toBe(true);
    expect(existsSync(join(fixture.backupDir, "platform.sqlite.backup"))).toBe(true);
    expect(existsSync(fixture.lockDir)).toBe(true);
    expect(readFileSync(join(fixture.lockDir, "state"), "utf8")).toContain(
      "STAGE=rollback_failed"
    );
  });

  it("rejects an active deployment lock without building or changing service state", () => {
    const fixture = createRemoteScenario();
    const result = runRemoteDeploy(fixture, true);
    expect(result.status).not.toBe(0);
    expect(result.output).toContain("Another deployment is active");
    const state = readDockerState(fixture);
    expect(state.events).not.toContain("compose:build");
    expect(state.service.image).toBe(fixture.oldImage);
    expect(existsSync(fixture.lockDir)).toBe(true);
    expect(existsSync(fixture.uploadDir), result.output).toBe(false);
  });

  it("recovers a simulated strong-kill stale lock before applying the current no-op", () => {
    const targetSha = "d".repeat(40);
    const oldImage = `home-party-game-platform:${targetSha}`;
    const fixture = createRemoteScenario({
      targetSha,
      markerSha: targetSha,
      oldImage
    });
    convertToStalePostCutover(fixture);

    const result = runRemoteDeploy(fixture);

    expect(result.status, result.output).toBe(0);
    expect(result.output).toContain("Recovering stale deployment");
    expect(result.output).toContain("no upload content will be applied");
    const state = readDockerState(fixture);
    expect(state.events).toContain("docker:run:restore");
    expect(state.service.image).toBe(oldImage);
    expect(state.service.health).toBe("healthy");
    expect(readFileSync(join(fixture.releaseDir, "version.txt"), "utf8")).toBe("old");
    expect(readFileSync(join(fixture.volumeDir, "platform.sqlite"))).toEqual(
      fixture.preDeploymentDatabase
    );
    expect(existsSync(fixture.lockDir)).toBe(false);
    expect(existsSync(fixture.uploadDir)).toBe(false);
  });
});

describe("deployment automation interruption and first-deploy boundaries", () => {
  it("handles TERM during the stopped backup stage by restoring the old service", () => {
    const fixture = createRemoteScenario({ failures: ["interrupt-backup"] });
    const backupBefore = readFileSync(
      join(fixture.backupDir, "platform.sqlite.backup")
    );

    const result = runRemoteDeploy(fixture);

    expect(result.status).toBe(130);
    expect(result.output).toContain("Recovering deployment stage 'backing_up'");
    const state = readDockerState(fixture);
    expect(state.events).toContain("docker:run:backup");
    expect(state.events).toContain("compose:start");
    expect(state.service.running).toBe(true);
    expect(state.service.health).toBe("healthy");
    expect(readFileSync(join(fixture.backupDir, "platform.sqlite.backup"))).toEqual(
      backupBefore
    );
    expect(existsSync(fixture.lockDir)).toBe(false);
    expect(existsSync(fixture.uploadDir)).toBe(false);
  });

  it("preserves recovery assets and stops the service when a first deployment has no old image", () => {
    const fixture = createRemoteScenario({
      failures: ["new-health"],
      hasOldService: false,
      mutateDatabaseOnNewStart: true
    });

    const result = runRemoteDeploy(fixture);

    expect(result.status).not.toBe(0);
    expect(result.output).toContain("No previous image exists");
    expect(result.output).toContain("Automatic recovery failed");
    const state = readDockerState(fixture);
    expect(state.service.running).toBe(false);
    expect(existsSync(join(fixture.backupDir, "platform.sqlite.backup"))).toBe(true);
    expect(readFileSync(join(fixture.volumeDir, "platform.sqlite"))).toEqual(
      fixture.preDeploymentDatabase
    );
    expect(existsSync(fixture.lockDir)).toBe(true);
    expect(readFileSync(join(fixture.lockDir, "state"), "utf8")).toContain(
      "STAGE=rollback_failed"
    );
  });
});

type JsonEvent = { tool: string; args: string[] };

type FakeDockerState = {
  nativeRoot: string;
  posixRoot: string;
  volumeName: string;
  volumeDir: string;
  failures: string[];
  events: string[];
  sequence: number;
  newImage?: string;
  mutatedDatabaseBase64?: string;
  images: Record<string, string>;
  service: {
    exists: boolean;
    running: boolean;
    root: string;
    image: string;
    imageId: string;
    containerId: string;
    health: string;
    restartCount: number;
  };
};

type LocalFixture = {
  root: string;
  repository: string;
  fakeBin: string;
  configPath: string;
  openSshLog: string;
  scpCapture: string;
};

type RemoteFixture = {
  root: string;
  releaseDir: string;
  backupDir: string;
  volumeDir: string;
  uploadDir: string;
  incomingDir: string;
  previousDir: string;
  lockDir: string;
  archivePath: string;
  remoteScriptPath: string;
  dockerStatePath: string;
  fakeBin: string;
  token: string;
  targetSha: string;
  oldImage: string;
  newImage: string;
  archiveHash: string;
  scriptHash: string;
  interruptBackup: boolean;
  preDeploymentDatabase: Buffer;
};

function createLocalRepository(): LocalFixture {
  assertLocalTools();
  const root = temporaryRoot("home-table-local-deploy-");
  const repository = join(root, "repository");
  const fakeBin = join(root, "fake-bin");
  const scpCapture = join(root, "scp-capture");
  const openSshLog = join(root, "openssh.jsonl");
  const configPath = join(root, "deploy.config.psd1");
  mkdirSync(join(repository, "deploy"), { recursive: true });
  mkdirSync(fakeBin, { recursive: true });
  copyFileSync(deployScriptSource, join(repository, "deploy/deploy.ps1"));
  copyFileSync(remoteScriptSource, join(repository, "deploy/remote-deploy.sh"));
  copyFileSync(composeSource, join(repository, "deploy/compose.yml"));
  writeFileSync(
    join(repository, ".gitignore"),
    "deploy/deploy.config.psd1\n",
    "utf8"
  );
  writeFileSync(
    join(fakeBin, "ssh.cmd"),
    '@echo off\r\n"%FAKE_NODE%" "%FAKE_OPENSSH_SCRIPT%" ssh %*\r\nexit /b %ERRORLEVEL%\r\n',
    "utf8"
  );
  writeFileSync(
    join(fakeBin, "scp.cmd"),
    '@echo off\r\n"%FAKE_NODE%" "%FAKE_OPENSSH_SCRIPT%" scp %*\r\nexit /b %ERRORLEVEL%\r\n',
    "utf8"
  );

  mustRun("git", ["init", "-q"], repository);
  mustRun("git", ["config", "user.email", "deploy-test@example.invalid"], repository);
  mustRun("git", ["config", "user.name", "Deploy Test"], repository);
  mustRun("git", ["add", "."], repository);
  mustRun("git", ["commit", "-q", "-m", "fixture"], repository);

  writeConfig(configPath);
  return { root, repository, fakeBin, configPath, openSshLog, scpCapture };
}

function compileNativeSshProbe(outputPath: string) {
  const encodedCommand = Buffer.from(
    `$source = @'\n${nativeSshProbeSource}\n'@\n` +
      `Add-Type -TypeDefinition $source -Language CSharp ` +
      `-OutputAssembly '${outputPath.replaceAll("'", "''")}' ` +
      "-OutputType ConsoleApplication",
    "utf16le"
  ).toString("base64");
  const result = spawnSync(
    powershell,
    ["-NoProfile", "-EncodedCommand", encodedCommand],
    { encoding: "utf8", timeout: 20_000 }
  );
  if (result.status !== 0 || !existsSync(outputPath)) {
    throw new Error(
      `Could not compile native SSH probe fixture: ${result.stdout ?? ""}${
        result.stderr ?? ""
      }`
    );
  }
}

function runLocalDeploy(
  fixture: LocalFixture,
  behavior: string,
  identityFile = ""
) {
  writeConfig(fixture.configPath, identityFile);
  const result = spawnSync(
    powershell,
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      join(fixture.repository, "deploy/deploy.ps1"),
      "-ConfigPath",
      fixture.configPath
    ],
    {
      cwd: fixture.repository,
      env: {
        ...process.env,
        PATH: `${fixture.fakeBin};${process.env.PATH ?? ""}`,
        FAKE_NODE: process.execPath,
        FAKE_OPENSSH_SCRIPT: fakeOpenSshSource,
        FAKE_OPENSSH_LOG: fixture.openSshLog,
        FAKE_OPENSSH_BEHAVIOR: behavior,
        FAKE_SCP_CAPTURE: fixture.scpCapture
      },
      encoding: "utf8",
      timeout: 20_000
    }
  );
  return {
    status: result.status,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`
  };
}

function writeConfig(path: string, identityFile = "") {
  const escapedIdentity = identityFile.replaceAll("'", "''");
  writeFileSync(
    path,
    `@{
  SshHost = 'party.test'
  SshUser = 'root'
  SshPort = 22
  IdentityFile = '${escapedIdentity}'
  RemoteReleaseDir = '/srv/home-table'
  RemoteBackupDir = '/srv/home-table-backup'
  PartyPort = 3000
  HealthTimeoutSeconds = 10
}
`,
    "utf8"
  );
}

function createRemoteScenario(
  options: {
    failures?: string[];
    targetSha?: string;
    markerSha?: string;
    oldImage?: string;
    initialHealth?: string;
    hasOldService?: boolean;
    mutateDatabaseOnNewStart?: boolean;
  } = {}
): RemoteFixture {
  assertLocalTools();
  const root = temporaryRoot("home-table-remote-deploy-");
  const releaseDir = join(root, "release");
  const backupDir = join(root, "backup");
  const volumeDir = join(root, "volume");
  const sourceDir = join(root, "source");
  const fakeBin = join(root, "fake-bin");
  const targetSha = options.targetSha ?? "b".repeat(40);
  const markerSha = options.markerSha ?? "a".repeat(40);
  const token = "1".repeat(32);
  const oldImage = options.oldImage ?? "home-party-game-platform:0.1.0";
  const hasOldService = options.hasOldService ?? true;
  const newImage = `home-party-game-platform:${targetSha}`;
  const uploadDir = `${releaseDir}.upload.${token}`;
  const incomingDir = `${releaseDir}.incoming.${token}`;
  const previousDir = `${releaseDir}.previous.${token}`;
  const lockDir = `${releaseDir}.deploy.lock`;
  const archivePath = join(uploadDir, "source.tar.gz");
  const remoteScriptPath = join(uploadDir, "remote-deploy.sh");
  const dockerStatePath = join(root, "docker-state.json");

  for (const directory of [
    join(releaseDir, "deploy"),
    backupDir,
    volumeDir,
    join(sourceDir, "deploy"),
    uploadDir,
    fakeBin
  ]) {
    mkdirSync(directory, { recursive: true });
  }

  copyFileSync(composeSource, join(releaseDir, "deploy/compose.yml"));
  copyFileSync(remoteScriptSource, join(releaseDir, "deploy/remote-deploy.sh"));
  writeFileSync(join(releaseDir, ".release-sha"), `${markerSha}\n`, "utf8");
  writeFileSync(join(releaseDir, "version.txt"), "old", "utf8");

  copyFileSync(composeSource, join(sourceDir, "deploy/compose.yml"));
  copyFileSync(remoteScriptSource, join(sourceDir, "deploy/remote-deploy.sh"));
  writeFileSync(join(sourceDir, "version.txt"), "new", "utf8");

  copyFileSync(remoteScriptSource, remoteScriptPath);
  const archivePosix = toPosix(archivePath);
  const sourcePosix = toPosix(sourceDir);
  mustRun(bash, ["-lc", 'tar -czf "$1" -C "$2" .', "--", archivePosix, sourcePosix]);

  const preDeploymentDatabase = sqliteDatabase("pre-deployment");
  writeFileSync(join(volumeDir, "platform.sqlite"), preDeploymentDatabase);
  writeFileSync(
    join(backupDir, "platform.sqlite.backup"),
    sqliteDatabase("previous-backup")
  );

  const state: FakeDockerState = {
    nativeRoot: root,
    posixRoot: toPosix(root),
    volumeName: "home-party-game-platform-data",
    volumeDir,
    failures: options.failures ?? [],
    events: [],
    sequence: 1,
    images: hasOldService ? { [oldImage]: "image-old-1" } : {},
    service: {
      exists: hasOldService,
      running: hasOldService,
      root: releaseDir,
      image: hasOldService ? oldImage : "",
      imageId: hasOldService ? "image-old-1" : "",
      containerId: hasOldService ? "container-old-1" : "",
      health: options.initialHealth ?? "healthy",
      restartCount: 0
    }
  };
  if (options.mutateDatabaseOnNewStart) {
    state.mutatedDatabaseBase64 = sqliteDatabase("mutated-by-new").toString("base64");
  }
  writeFileSync(dockerStatePath, JSON.stringify(state, null, 2), "utf8");
  createFakeDockerBin(fakeBin);

  return {
    root,
    releaseDir,
    backupDir,
    volumeDir,
    uploadDir,
    incomingDir,
    previousDir,
    lockDir,
    archivePath,
    remoteScriptPath,
    dockerStatePath,
    fakeBin,
    token,
    targetSha,
    oldImage,
    newImage,
    archiveHash: sha256(archivePath),
    scriptHash: sha256(remoteScriptPath),
    interruptBackup: options.failures?.includes("interrupt-backup") ?? false,
    preDeploymentDatabase
  };
}

function runRemoteDeploy(
  fixture: RemoteFixture,
  activeLockOwnedByDeployProcess = false
) {
  const args = [
    toPosix(fixture.remoteScriptPath),
    "deploy",
    fixture.targetSha,
    toPosix(fixture.archivePath),
    fixture.archiveHash,
    fixture.scriptHash,
    toPosix(fixture.releaseDir),
    toPosix(fixture.backupDir),
    "3000",
    "10",
    fixture.token
  ];
  let commandArgs = args;
  if (activeLockOwnedByDeployProcess) {
    const remoteScriptArgument = args[0];
    if (!remoteScriptArgument) {
      throw new Error("Remote deploy test script argument is missing");
    }
    mkdirSync(fixture.lockDir, { recursive: true });
    const ownerPath = toPosix(join(fixture.lockDir, "owner"));
    const wrapper = [
      "owner=$1",
      "script=$2",
      "shift 2",
      'start=$(awk \'{ print $22 }\' "/proc/$$/stat")',
      `printf "PID=%s\\nSTART=%s\\nTOKEN=%s\\nSHA=%s\\n" "$$" "$start" "${"9".repeat(
        32
      )}" "${"8".repeat(40)}" > "$owner"`,
      'bash "$script" "$@"'
    ].join("; ");
    commandArgs = [
      "-lc",
      wrapper,
      "--",
      ownerPath,
      remoteScriptArgument,
      ...args.slice(1)
    ];
  }
  const result = spawnSync(bash, commandArgs, {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      PATH: `${fixture.fakeBin};${process.env.PATH ?? ""}`,
      FAKE_NODE: toPosix(process.execPath),
      FAKE_DOCKER_SCRIPT: toPosix(fakeDockerSource),
      FAKE_DOCKER_STATE: fixture.dockerStatePath,
      FAKE_INTERRUPT_BACKUP: fixture.interruptBackup ? "1" : "0"
    },
    encoding: "utf8",
    timeout: 20_000
  });
  if (result.error) {
    throw new Error(`Remote deploy test process failed: ${result.error.message}`);
  }
  return {
    status: result.status,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`
  };
}

function createFakeDockerBin(fakeBin: string) {
  writeFileSync(
    join(fakeBin, "docker"),
    `#!/bin/sh
node_win=$(cygpath -w "$FAKE_NODE")
script_win=$(cygpath -w "$FAKE_DOCKER_SCRIPT")
MSYS2_ARG_CONV_EXCL='*' "$node_win" "$script_win" "$@"
docker_status=$?
if [ "\${FAKE_INTERRUPT_BACKUP:-0}" = "1" ] && [ "$1" = "run" ]; then
  case " $* " in
    *":/data:ro"*)
      kill -TERM "$PPID"
      exit 143
      ;;
  esac
fi
exit "$docker_status"
`,
    "utf8"
  );
  writeFileSync(join(fakeBin, "sleep"), "#!/bin/sh\nexit 0\n", "utf8");
}

function convertToStalePostCutover(fixture: RemoteFixture) {
  const staleToken = "2".repeat(32);
  const stalePrevious = `${fixture.releaseDir}.previous.${staleToken}`;
  const staleFailed = `${fixture.releaseDir}.failed.${staleToken}`;
  const failedSha = "e".repeat(40);
  const failedImage = `home-party-game-platform:${failedSha}`;
  const rollbackImage = `home-party-game-platform:rollback-${staleToken}`;

  rmSync(stalePrevious, { recursive: true, force: true });
  mkdirSync(dirname(stalePrevious), { recursive: true });
  copyTree(fixture.releaseDir, stalePrevious);
  writeFileSync(join(stalePrevious, ".release-sha"), `${fixture.targetSha}\n`, "utf8");
  writeFileSync(join(stalePrevious, "version.txt"), "old", "utf8");

  writeFileSync(join(fixture.releaseDir, ".release-sha"), `${failedSha}\n`, "utf8");
  writeFileSync(join(fixture.releaseDir, "version.txt"), "failed-new", "utf8");
  writeFileSync(join(fixture.volumeDir, "platform.sqlite"), sqliteDatabase("mutated"));
  writeFileSync(join(fixture.volumeDir, "platform.sqlite-wal"), "wal", "utf8");
  writeFileSync(join(fixture.volumeDir, "platform.sqlite-shm"), "shm", "utf8");
  writeFileSync(
    join(fixture.backupDir, "platform.sqlite.backup"),
    fixture.preDeploymentDatabase
  );

  mkdirSync(fixture.lockDir, { recursive: true });
  writeFileSync(
    join(fixture.lockDir, "owner"),
    `PID=999999
START=0
TOKEN=${staleToken}
SHA=${failedSha}
`,
    "utf8"
  );
  writeFileSync(
    join(fixture.lockDir, "state"),
    `STAGE=new_started
TOKEN=${staleToken}
SHA=${failedSha}
HAD_OLD=1
OLD_CONTAINER=container-old-1
OLD_IMAGE=${fixture.oldImage}
NEW_IMAGE=${failedImage}
ROLLBACK_IMAGE=${rollbackImage}
`,
    "utf8"
  );

  const state = readDockerState(fixture);
  state.newImage = failedImage;
  state.images[failedImage] = "image-failed";
  state.images[rollbackImage] = "image-old-1";
  state.service = {
    exists: true,
    running: true,
    root: fixture.releaseDir,
    image: failedImage,
    imageId: "image-failed",
    containerId: "container-failed",
    health: "unhealthy",
    restartCount: 0
  };
  writeFileSync(fixture.dockerStatePath, JSON.stringify(state, null, 2), "utf8");
  expect(existsSync(staleFailed)).toBe(false);
}

function readDockerState(fixture: RemoteFixture): FakeDockerState {
  return JSON.parse(readFileSync(fixture.dockerStatePath, "utf8")) as FakeDockerState;
}

function readJsonLines(path: string): JsonEvent[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as JsonEvent);
}

function listTar(path: string) {
  const result = mustRun(bash, ["-lc", 'tar -tzf "$1"', "--", toPosix(path)]);
  return result.stdout
    .split(/\r?\n/)
    .map((entry) => entry.replace(/^\.\//, ""))
    .filter(Boolean);
}

function indexOfEvent(events: string[], event: string) {
  const index = events.indexOf(event);
  expect(index).toBeGreaterThanOrEqual(0);
  return index;
}

function indexOfEventPrefix(events: string[], prefix: string) {
  const index = events.findIndex((event) => event.startsWith(prefix));
  expect(index).toBeGreaterThanOrEqual(0);
  return index;
}

function sqliteDatabase(label: string) {
  const buffer = Buffer.alloc(256);
  buffer.write("SQLite format 3\0", 0, "binary");
  buffer.write(label, 16, "utf8");
  return buffer;
}

function sha256(path: string) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function toPosix(path: string) {
  const result = mustRun(bash, ["-lc", 'cygpath -u "$1"', "--", path]);
  return result.stdout.trim();
}

function temporaryRoot(prefix: string) {
  const root = mkdtempSync(join(tmpdir(), prefix));
  temporaryRoots.add(root);
  return root;
}

function assertLocalTools() {
  expect(existsSync(powershell)).toBe(true);
  expect(existsSync(bash)).toBe(true);
}

function mustRun(
  command: string,
  args: string[],
  cwd = repositoryRoot
): { stdout: string; stderr: string } {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    timeout: 20_000
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed (${result.status}):\n${result.stdout ?? ""}${result.stderr ?? ""}`
    );
  }
  return { stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function copyTree(source: string, destination: string) {
  mkdirSync(destination, { recursive: true });
  for (const entry of [
    "deploy/compose.yml",
    "deploy/remote-deploy.sh",
    ".release-sha",
    "version.txt"
  ]) {
    const target = join(destination, entry);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(source, entry), target);
  }
}
