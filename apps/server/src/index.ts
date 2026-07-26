import { resolve } from "node:path";
import { buildApp, defaultStaticRoot } from "./app.js";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";
const databasePath = resolve(process.env.DATABASE_PATH ?? "data/platform.sqlite");
const staticRoot = process.env.STATIC_ROOT ?? defaultStaticRoot();

try {
  const app = await buildApp({ databasePath, staticRoot, logger: true });
  await app.listen({ port, host });
} catch (error) {
  console.error(
    JSON.stringify({
      level: "error",
      event: "startup_failed",
      error:
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : String(error)
    })
  );
  process.exitCode = 1;
}
