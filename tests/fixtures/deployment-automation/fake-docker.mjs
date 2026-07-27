import {
  copyFileSync,
  existsSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

let state;
const statePath = nativePath(process.env.FAKE_DOCKER_STATE ?? "");
if (!statePath) {
  console.error("FAKE_DOCKER_STATE is required");
  process.exit(90);
}

const args = process.argv.slice(2);
state = JSON.parse(readFileSync(statePath, "utf8"));
state.events ??= [];
state.images ??= {};
state.sequence ??= 0;

const result = dispatch(args);
writeFileSync(statePath, JSON.stringify(state, null, 2), "utf8");
if (result.output) process.stdout.write(result.output);
if (result.error) process.stderr.write(result.error);
process.exit(result.code);

function dispatch(values) {
  if (values[0] === "compose") return compose(values.slice(1));
  if (values[0] === "inspect") return inspectContainer(values.slice(1));
  if (values[0] === "image") return image(values.slice(1));
  if (values[0] === "volume") return volume(values.slice(1));
  if (values[0] === "run") return run(values.slice(1));
  return failure(`unsupported docker command: ${values.join(" ")}`);
}

function compose(values) {
  const action = values[0];
  if (action === "version") return success("Docker Compose version fake\n");

  const composeRoot = dirname(process.cwd());
  const imageName =
    process.env.PARTY_IMAGE ?? "home-party-game-platform:0.1.0";

  if (action === "ps") {
    record(`compose:ps:${basename(composeRoot)}`);
    if (state.service?.exists && state.service.running) {
      return success(`${state.service.containerId}\n`);
    }
    return success();
  }

  if (action === "build") {
    record("compose:build");
    if (hasFailure("build")) return failure("simulated build failure\n");
    state.newImage = imageName;
    state.images[imageName] = `image-new-${++state.sequence}`;
    return success();
  }

  if (action === "stop") {
    record("compose:stop");
    if (state.service?.exists) state.service.running = false;
    return success();
  }

  if (action === "start") {
    record("compose:start");
    if (!state.service?.exists) return failure("service does not exist\n");
    state.service.running = true;
    state.service.root = composeRoot;
    state.service.health = hasFailure("old-health") ? "unhealthy" : "healthy";
    return success();
  }

  if (action === "up") {
    record(`compose:up:${imageName}`);
    if (hasFailure("up")) return failure("simulated compose up failure\n");
    const isNew = imageName === state.newImage;
    state.service = {
      exists: true,
      running: true,
      root: composeRoot,
      image: imageName,
      imageId: state.images[imageName],
      containerId: `container-${++state.sequence}`,
      health:
        (isNew && hasFailure("new-health")) ||
        (!isNew && hasFailure("old-health"))
          ? "unhealthy"
          : "healthy",
      restartCount: 0
    };
    if (isNew && state.mutatedDatabaseBase64) {
      writeFileSync(
        join(state.volumeDir, "platform.sqlite"),
        Buffer.from(state.mutatedDatabaseBase64, "base64")
      );
      writeFileSync(join(state.volumeDir, "platform.sqlite-wal"), "mutated-wal");
      writeFileSync(join(state.volumeDir, "platform.sqlite-shm"), "mutated-shm");
      record("database:mutated-by-new-service");
    }
    return success();
  }

  if (action === "logs") return success("fake compose logs\n");
  return failure(`unsupported compose command: ${values.join(" ")}\n`);
}

function inspectContainer(values) {
  const formatIndex = values.indexOf("--format");
  const format = formatIndex >= 0 ? values[formatIndex + 1] : "";
  const containerId = values.at(-1);
  if (
    !state.service?.exists ||
    state.service.containerId !== containerId
  ) {
    return failure("container not found\n");
  }
  if (format.includes(".Config.Image")) return success(`${state.service.image}\n`);
  if (format.includes(".State.Health.Status")) {
    return success(`${state.service.health}\n`);
  }
  if (format.includes(".RestartCount")) {
    return success(`${state.service.restartCount ?? 0}\n`);
  }
  return success("{}\n");
}

function image(values) {
  const action = values[0];
  if (action === "inspect") {
    const reference = values.at(-1);
    const imageId = state.images[reference];
    if (!imageId) return failure("image not found\n");
    return values.includes("--format")
      ? success(`${imageId}\n`)
      : success("{}\n");
  }
  if (action === "tag") {
    const source = values[1];
    const destination = values[2];
    const imageId = state.images[source];
    if (!imageId) return failure("source image not found\n");
    state.images[destination] = imageId;
    record(`image:tag:${source}->${destination}`);
    return success();
  }
  if (action === "rm") {
    const reference = values.at(-1);
    if (!state.images[reference]) return failure("image not found\n");
    if (hasFailure("image-remove")) {
      return failure("simulated image removal failure\n");
    }
    delete state.images[reference];
    record(`image:rm:${reference}`);
    return success();
  }
  return failure(`unsupported image command: ${values.join(" ")}\n`);
}

function volume(values) {
  if (values[0] === "inspect" && values[1] === state.volumeName) {
    record("volume:inspect");
    return success("{}\n");
  }
  return failure("volume not found\n");
}

function run(values) {
  const mounts = mountMap(values);
  const dataMount = mounts.get("/data");
  const backupMount = mounts.get("/backup");
  if (!dataMount || !backupMount) return failure("expected mounts are missing\n");

  const volumeDirectory =
    dataMount.source === state.volumeName
      ? state.volumeDir
      : nativePath(dataMount.source);
  const backupDirectory = nativePath(backupMount.source);

  if (dataMount.readOnly && !backupMount.readOnly) {
    record("docker:run:backup");
    if (hasFailure("interrupt-backup")) {
      return failure("simulated deployment interruption\n");
    }
    if (hasFailure("backup")) return failure("simulated backup failure\n");
    const destinationArg = values.at(-1);
    const destination = join(backupDirectory, basename(destinationArg));
    copyFileSync(join(volumeDirectory, "platform.sqlite"), destination);
    return success();
  }

  if (!dataMount.readOnly && backupMount.readOnly) {
    record("docker:run:restore");
    if (hasFailure("restore")) return failure("simulated restore failure\n");
    copyFileSync(
      join(backupDirectory, "platform.sqlite.backup"),
      join(volumeDirectory, "platform.sqlite")
    );
    for (const suffix of ["-wal", "-shm"]) {
      const sidecar = join(volumeDirectory, `platform.sqlite${suffix}`);
      if (existsSync(sidecar)) rmSync(sidecar, { force: true });
    }
    return success();
  }

  return failure("unexpected docker run mount mode\n");
}

function mountMap(values) {
  const result = new Map();
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] !== "-v") continue;
    const specification = values[index + 1];
    index += 1;
    const match = specification.match(/^(.*):(\/data|\/backup)(:ro)?$/);
    if (!match) continue;
    result.set(match[2], {
      source: match[1],
      readOnly: Boolean(match[3])
    });
  }
  return result;
}

function hasFailure(name) {
  return Array.isArray(state.failures) && state.failures.includes(name);
}

function record(event) {
  state.events.push(event);
}

function success(output = "") {
  return { code: 0, output };
}

function failure(error) {
  return { code: 1, error };
}

function nativePath(value) {
  if (!value) return "";
  if (state?.posixRoot && state?.nativeRoot) {
    if (value === state.posixRoot) return state.nativeRoot;
    if (value.startsWith(`${state.posixRoot}/`)) {
      return resolve(state.nativeRoot, value.slice(state.posixRoot.length + 1));
    }
  }
  const driveMatch = value.match(/^\/([a-zA-Z])\/(.*)$/);
  if (driveMatch) return resolve(`${driveMatch[1]}:/${driveMatch[2]}`);
  return resolve(value);
}
