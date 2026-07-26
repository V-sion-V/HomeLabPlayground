import { describe, expect, it } from "vitest";
import { buildApp } from "../apps/server/src/app";
import { temporaryDatabase } from "@party/test-support";

describe("server", () => {
  it("starts with a temporary database and enters an account without a password", async () => {
    const app = await buildApp({ databasePath: temporaryDatabase() });
    const health = await app.inject({ method: "GET", url: "/healthz" });
    expect(health.statusCode).toBe(200);
    const response = await app.inject({
      method: "POST",
      url: "/api/enter",
      payload: { username: "小明", avatar: "🐼" }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.account.username).toBe("小明");
    expect(body.data.connectionId).toBeTypeOf("string");
    expect(JSON.stringify(body)).not.toContain("password");
    await app.close();
  });
});
