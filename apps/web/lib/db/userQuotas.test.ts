import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

vi.mock("server-only", () => ({}));
const fixture = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("./client", () => fixture);

const directory = mkdtempSync(path.join(os.tmpdir(), "overtchat-quotas-"));
vi.stubEnv("DATABASE_URL", path.join(directory, "test.db"));
const raw = new Database(":memory:");
raw.pragma("foreign_keys = ON");
fixture.db = drizzle(raw);
migrate(fixture.db as ReturnType<typeof drizzle>, {
  migrationsFolder: path.resolve("drizzle"),
});
const quotas = await import("./userQuotas");

const NOW = new Date("2026-11-18T12:00:00Z");
const USD = quotas.NANO_USD_PER_USD;

afterAll(() => {
  raw.close();
  rmSync(directory, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

beforeEach(() => {
  raw.exec(`DELETE FROM user_quotas;
    DELETE FROM quota_settings;
    DELETE FROM generation_usage;
    DELETE FROM user;
    INSERT INTO user (id, name, email) VALUES ('alice', 'Alice', 'alice@test.local'), ('bob', 'Bob', 'bob@test.local');`);
});

function usage(
  id: string,
  userId: string,
  nanoUsd: number,
  occurredAt: Date,
  context: "chat" | "title" | "image" = "chat",
) {
  raw
    .prepare(
      "INSERT INTO generation_usage (id, user_id, context, occurred_at, provider_id, model, total_cost_nano_usd) VALUES (?, ?, ?, ?, 'openai', 'gpt-5', ?)",
    )
    .run(id, userId, context, occurredAt.getTime(), nanoUsd);
}

describe("user quotas", () => {
  it("is unlimited when no default is configured", () => {
    expect(quotas.checkUserQuota("alice", NOW)).toEqual({
      limitNanoUsd: null,
      spentNanoUsd: 0,
      exceeded: false,
    });
  });

  it("enforces the default monthly limit", () => {
    quotas.setDefaultMonthlyLimitNanoUsd(10 * USD);
    usage("u1", "alice", 9 * USD, NOW);
    expect(quotas.checkUserQuota("alice", NOW).exceeded).toBe(false);
    usage("u2", "alice", 1 * USD, NOW);
    expect(quotas.checkUserQuota("alice", NOW)).toMatchObject({
      limitNanoUsd: 10 * USD,
      spentNanoUsd: 10 * USD,
      exceeded: true,
    });
    expect(quotas.checkUserQuota("bob", NOW).exceeded).toBe(false);
  });

  it("counts only the current calendar month in UTC", () => {
    quotas.setDefaultMonthlyLimitNanoUsd(10 * USD);
    usage("old", "alice", 50 * USD, new Date("2026-10-31T23:59:59Z"));
    usage("future", "alice", 50 * USD, new Date("2026-12-01T00:00:00Z"));
    usage("current", "alice", 1 * USD, new Date("2026-11-01T00:00:00Z"));
    expect(quotas.checkUserQuota("alice", NOW)).toMatchObject({
      spentNanoUsd: 1 * USD,
      exceeded: false,
    });
  });

  it("counts title and image generations toward the quota", () => {
    quotas.setDefaultMonthlyLimitNanoUsd(10 * USD);
    usage("t", "alice", 4 * USD, NOW, "title");
    usage("i", "alice", 6 * USD, NOW, "image");
    expect(quotas.checkUserQuota("alice", NOW).exceeded).toBe(true);
  });

  it("excludes generations run on the user's own API key", () => {
    quotas.setDefaultMonthlyLimitNanoUsd(10 * USD);
    raw
      .prepare(
        "INSERT INTO generation_usage (id, user_id, context, occurred_at, provider_id, model, total_cost_nano_usd, own_key) VALUES ('own', 'alice', 'chat', ?, 'openai', 'gpt-5', ?, 1)",
      )
      .run(NOW.getTime(), 50 * USD);
    usage("server", "alice", 1 * USD, NOW);
    expect(quotas.checkUserQuota("alice", NOW)).toMatchObject({
      spentNanoUsd: 1 * USD,
      exceeded: false,
    });
    expect(quotas.listMonthlyCostsNanoUsd(NOW).get("alice")).toBe(1 * USD);
  });

  it("lets a per-user limit override the default", () => {
    quotas.setDefaultMonthlyLimitNanoUsd(10 * USD);
    quotas.setUserQuota("alice", "limit", 2 * USD);
    usage("u1", "alice", 3 * USD, NOW);
    expect(quotas.checkUserQuota("alice", NOW)).toMatchObject({
      limitNanoUsd: 2 * USD,
      exceeded: true,
    });
    expect(quotas.checkUserQuota("bob", NOW).exceeded).toBe(false);
  });

  it("lets a per-user unlimited override beat a limited default", () => {
    quotas.setDefaultMonthlyLimitNanoUsd(1 * USD);
    quotas.setUserQuota("alice", "unlimited", null);
    usage("u1", "alice", 100 * USD, NOW);
    expect(quotas.checkUserQuota("alice", NOW).exceeded).toBe(false);
  });

  it("falls back to the default for inherit overrides", () => {
    quotas.setDefaultMonthlyLimitNanoUsd(5 * USD);
    quotas.setUserQuota("alice", "inherit", null);
    expect(quotas.effectiveMonthlyLimitNanoUsd("alice")).toBe(5 * USD);
  });

  it("blocks all generation with a zero limit", () => {
    quotas.setUserQuota("alice", "limit", 0);
    expect(quotas.checkUserQuota("alice", NOW).exceeded).toBe(true);
  });

  it("clears the stored limit when switching away from limit mode", () => {
    quotas.setUserQuota("alice", "limit", 5 * USD);
    const row = quotas.setUserQuota("alice", "unlimited", null);
    expect(row.monthlyLimitNanoUsd).toBeNull();
  });

  it("lists monthly costs per user", () => {
    usage("a1", "alice", 2 * USD, NOW);
    usage("a2", "alice", 3 * USD, NOW);
    usage("b1", "bob", 7 * USD, NOW);
    usage("old", "bob", 100 * USD, new Date("2026-10-01T00:00:00Z"));
    const costs = quotas.listMonthlyCostsNanoUsd(NOW);
    expect(costs.get("alice")).toBe(5 * USD);
    expect(costs.get("bob")).toBe(7 * USD);
  });

  it("removes overrides when the user is deleted", () => {
    quotas.setUserQuota("alice", "limit", 5 * USD);
    raw.exec("DELETE FROM user WHERE id = 'alice'");
    expect(quotas.getUserQuota("alice")).toBeNull();
  });
});