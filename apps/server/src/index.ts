import { resolve } from "node:path";
import { buildApp, defaultStaticRoot } from "./app.js";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";
const databasePath = resolve(process.env.DATABASE_PATH ?? "data/platform.sqlite");
const staticRoot = process.env.STATIC_ROOT ?? defaultStaticRoot();

const app = await buildApp({ databasePath, staticRoot, logger: true });

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error({ error }, "startup_failed");
  process.exitCode = 1;
}
