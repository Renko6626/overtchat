import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getDefault: vi.fn(),
  setDefault: vi.fn(),
  listOverrides: vi.fn(),
  listCosts: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server", () => ({
  auth: { api: { getSession: mocks.getSession } },
}));
vi.mock("@/lib/db/userQuotas", () => ({
  NANO_USD_PER_USD: 1_000_000_000,
  getDefaultMonthlyLimitNanoUsd: mocks.getDefault,
  setDefaultMonthlyLimitNanoUsd: mocks.setDefault,
  listUserQuotas: mocks.listOverrides,
  listMonthlyCostsNanoUsd: mocks.listCosts,
}));

import { GET, PUT } from "./route";

function request(method: string, body?: object): Request {
  return new Request("http://server.test/api/users/quotas", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("quota settings API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({
      user: { id: "admin", role: "admin" },
    });
    mocks.getDefault.mockReturnValue(null);
    mocks.listOverrides.mockReturnValue([]);
    mocks.listCosts.mockReturnValue(new Map());
  });

  it("requires an administrator", async () => {
    mocks.getSession.mockResolvedValue({ user: { role: "user" } });
    expect((await GET(request("GET"))).status).toBe(403);
    expect((await PUT(request("PUT", { defaultMonthlyLimitUsd: 5 }))).status).toBe(403);
  });

  it("returns the default, overrides, and monthly costs in USD", async () => {
    mocks.getDefault.mockReturnValue(10_000_000_000);
    mocks.listOverrides.mockReturnValue([
      { userId: "alice", mode: "limit", monthlyLimitNanoUsd: 2_000_000_000 },
    ]);
    mocks.listCosts.mockReturnValue(new Map([["alice", 1_500_000_000]]));

    await expect((await GET(request("GET"))).json()).resolves.toEqual({
      defaultMonthlyLimitUsd: 10,
      overrides: [{ userId: "alice", mode: "limit", monthlyLimitUsd: 2 }],
      monthlyCostsUsd: { alice: 1.5 },
    });
  });

  it("stores a USD default as nano-USD", async () => {
    const response = await PUT(
      request("PUT", { defaultMonthlyLimitUsd: 12.5 }),
    );
    expect(response.status).toBe(200);
    expect(mocks.setDefault).toHaveBeenCalledWith(12_500_000_000);
  });

  it("accepts null to remove the default limit", async () => {
    const response = await PUT(
      request("PUT", { defaultMonthlyLimitUsd: null }),
    );
    expect(response.status).toBe(200);
    expect(mocks.setDefault).toHaveBeenCalledWith(null);
  });

  it("rejects negative or missing limits", async () => {
    expect(
      (await PUT(request("PUT", { defaultMonthlyLimitUsd: -1 }))).status,
    ).toBe(400);
    expect((await PUT(request("PUT", {}))).status).toBe(400);
    expect(mocks.setDefault).not.toHaveBeenCalled();
  });
});