import { z } from "zod";
import { auth } from "@/lib/auth/server";
import {
  getDefaultMonthlyLimitNanoUsd,
  listMonthlyCostsNanoUsd,
  listUserQuotas,
  NANO_USD_PER_USD,
  setDefaultMonthlyLimitNanoUsd,
} from "@/lib/db/userQuotas";

const bodySchema = z.object({
  defaultMonthlyLimitUsd: z.number().min(0).max(100_000).nullable(),
});

function toUsd(nanoUsd: number | null): number | null {
  return nanoUsd === null ? null : nanoUsd / NANO_USD_PER_USD;
}

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (session.user.role !== "admin") {
    return new Response("Forbidden", { status: 403 });
  }

  const costs = listMonthlyCostsNanoUsd();
  return Response.json({
    defaultMonthlyLimitUsd: toUsd(getDefaultMonthlyLimitNanoUsd()),
    overrides: listUserQuotas().map((row) => ({
      userId: row.userId,
      mode: row.mode,
      monthlyLimitUsd: toUsd(row.monthlyLimitNanoUsd),
    })),
    monthlyCostsUsd: Object.fromEntries(
      [...costs.entries()].map(([userId, nanoUsd]) => [
        userId,
        nanoUsd / NANO_USD_PER_USD,
      ]),
    ),
  });
}

export async function PUT(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (session.user.role !== "admin") {
    return new Response("Forbidden", { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "Enter a valid monthly limit in USD, or null for unlimited." },
      { status: 400 },
    );
  }
  const limitUsd = parsed.data.defaultMonthlyLimitUsd;
  setDefaultMonthlyLimitNanoUsd(
    limitUsd === null ? null : Math.round(limitUsd * NANO_USD_PER_USD),
  );
  return Response.json({ defaultMonthlyLimitUsd: limitUsd });
}