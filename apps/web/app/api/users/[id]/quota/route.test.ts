import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  userExists: vi.fn(),
  setUserQuota: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server", () => ({
  auth: { api: { getSession: mocks.getSession } },
}));
vi.mock("@/lib/db/users", () => ({
  userExists: mocks.userExists,
}));
vi.mock("@/lib/db/userQuotas", () => ({
  NANO_USD_PER_USD: 1_000_000_000,
  setUserQuota: mocks.setUserQuota,
}));

import { PUT } from "./route";

function request(body: object): Request {
  return new Request("http://server.test/api/users/alice/quota", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const params = { params: Promise.resolve({ id: "alice" }) };

describe("per-user quota API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({
      user: { id: "admin", role: "admin" },
    });
    mocks.userExists.mockReturnValue(true);
    mocks.setUserQuota.mockImplementation(
      (userId: string, mode: string, limit: number | null) => ({
        userId,
        mode,
        monthlyLimitNanoUsd: limit,
      }),
    );
  });

  it("requires an administrator", async () => {
    mocks.getSession.mockResolvedValue({ user: { role: "user" } });
    expect((await PUT(request({ mode: "inherit" }), params)).status).toBe(403);
  });

  it("returns 404 for unknown users", async () => {
    mocks.userExists.mockReturnValue(false);
    expect((await PUT(request({ mode: "inherit" }), params)).status).toBe(404);
  });

  it("stores a fixed limit as nano-USD", async () => {
    const response = await PUT(
      request({ mode: "limit", monthlyLimitUsd: 3.25 }),
      params,
    );
    expect(response.status).toBe(200);
    expect(mocks.setUserQuota).toHaveBeenCalledWith(
      "alice",
      "limit",
      3_250_000_000,
    );
    await expect(response.json()).resolves.toEqual({
      quota: { userId: "alice", mode: "limit", monthlyLimitUsd: 3.25 },
    });
  });

  it("requires an amount for limit mode", async () => {
    expect((await PUT(request({ mode: "limit" }), params)).status).toBe(400);
    expect(
      (await PUT(request({ mode: "limit", monthlyLimitUsd: -2 }), params))
        .status,
    ).toBe(400);
    expect(mocks.setUserQuota).not.toHaveBeenCalled();
  });

  it("clears the amount for inherit and unlimited modes", async () => {
    await PUT(
      request({ mode: "unlimited", monthlyLimitUsd: 99 }),
      params,
    );
    expect(mocks.setUserQuota).toHaveBeenCalledWith("alice", "unlimited", null);
    await PUT(request({ mode: "inherit" }), params);
    expect(mocks.setUserQuota).toHaveBeenCalledWith("alice", "inherit", null);
  });
});