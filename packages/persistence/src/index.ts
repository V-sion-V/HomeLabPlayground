import Database from "better-sqlite3";
import type { CommandEnvelope, CommandResult, PlatformSnapshot } from "@party/contracts";
import { DomainError, initialSnapshot, PlatformDomain } from "@party/domain";

const migrations = [
  `CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS platform_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    version INTEGER NOT NULL,
    state_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS processed_commands (
    command_id TEXT PRIMARY KEY,
    result_json TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS scheduled_actions (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    deadline INTEGER NOT NULL,
    payload_json TEXT NOT NULL
  );`
];

export class PlatformStore {
  private readonly db: Database.Database;

  constructor(filename: string) {
    this.db = new Database(filename);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.migrate();
  }

  close(): void {
    this.db.close();
  }

  load(): PlatformSnapshot {
    const row = this.db
      .prepare("SELECT state_json FROM platform_state WHERE id = 1")
      .get() as { state_json: string } | undefined;
    if (!row) {
      const state = initialSnapshot();
      this.save(state);
      return state;
    }
    return JSON.parse(row.state_json) as PlatformSnapshot;
  }

  save(state: PlatformSnapshot): void {
    this.db
      .prepare(
        `INSERT INTO platform_state (id, version, state_json, updated_at)
         VALUES (1, @version, @state, @now)
         ON CONFLICT(id) DO UPDATE SET
           version = excluded.version,
           state_json = excluded.state_json,
           updated_at = excluded.updated_at`
      )
      .run({ version: state.version, state: JSON.stringify(state), now: Date.now() });
  }

  execute<T>(
    envelope: CommandEnvelope,
    handler: (domain: PlatformDomain) => T
  ): CommandResult<T> {
    const transaction = this.db.transaction(() => {
      const replay = this.db
        .prepare("SELECT result_json FROM processed_commands WHERE command_id = ?")
        .get(envelope.commandId) as { result_json: string } | undefined;
      if (replay) {
        const saved = JSON.parse(replay.result_json) as CommandResult<T>;
        return { ...saved, status: "replayed" as const };
      }

      const state = this.load();
      if (envelope.expectedVersion !== state.version) {
        return this.persistResult<T>(envelope.commandId, {
          status: "rejected",
          code: "STALE_VERSION",
          version: state.version
        });
      }

      try {
        const domain = new PlatformDomain(state);
        const data = handler(domain);
        domain.validateInvariants();
        state.version += 1;
        this.save(state);
        return this.persistResult<T>(envelope.commandId, {
          status: "accepted",
          code: "OK",
          version: state.version,
          data
        });
      } catch (error) {
        if (error instanceof DomainError) {
          return this.persistResult<T>(envelope.commandId, {
            status: "rejected",
            code: error.code,
            version: state.version
          });
        }
        throw error;
      }
    });
    return transaction();
  }

  schedule(id: string, roomId: string, kind: string, deadline: number, payload: unknown): void {
    this.db
      .prepare(
        `INSERT INTO scheduled_actions (id, room_id, kind, deadline, payload_json)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET deadline = excluded.deadline, payload_json = excluded.payload_json`
      )
      .run(id, roomId, kind, deadline, JSON.stringify(payload));
  }

  due(now = Date.now()): Array<{
    id: string;
    roomId: string;
    kind: string;
    deadline: number;
    payload: unknown;
  }> {
    const rows = this.db
      .prepare(
        "SELECT id, room_id, kind, deadline, payload_json FROM scheduled_actions WHERE deadline <= ? ORDER BY deadline"
      )
      .all(now) as Array<{
      id: string;
      room_id: string;
      kind: string;
      deadline: number;
      payload_json: string;
    }>;
    return rows.map((row) => ({
      id: row.id,
      roomId: row.room_id,
      kind: row.kind,
      deadline: row.deadline,
      payload: JSON.parse(row.payload_json)
    }));
  }

  private persistResult<T>(commandId: string, result: CommandResult<T>): CommandResult<T> {
    this.db
      .prepare(
        "INSERT INTO processed_commands (command_id, result_json, created_at) VALUES (?, ?, ?)"
      )
      .run(commandId, JSON.stringify(result), Date.now());
    return result;
  }

  private migrate(): void {
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at INTEGER NOT NULL
      )`
    );
    const apply = this.db.transaction(() => {
      for (const [index, sql] of migrations.entries()) {
        const version = index + 1;
        const present = this.db
          .prepare("SELECT 1 FROM schema_migrations WHERE version = ?")
          .get(version);
        if (present) continue;
        this.db.exec(sql);
        this.db
          .prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)")
          .run(version, Date.now());
      }
    });
    apply();
  }
}
