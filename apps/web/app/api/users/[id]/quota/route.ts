import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { userExists } from "@/lib/db/users";
import {
  NANO_USD_PER_USD,
  setUserQuota,
} from "@/lib/db/userQuotas";

const bodySchema = z
  .object({
    mode: z.enum(["inherit", "unlimited", "limit"]),
    monthlyLimitUsd: z.number().min(0).max(100_000).nullable().optional(),
  })
  .refine(
    (value) =>
      value.mode !== "limit" ||
      (typeof value.monthlyLimitUsd === "number" &&
        Number.isFinite(value.monthlyLimitUsd)),
    "Enter a monthly limit in USD for a fixed quota.",
  );

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (session.user.role !== "admin") {
    return new Response("Forbidden", { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid quota." },
      { status: 400 },
    );
  }

  const { id } = await params;
  if (!userExists(id)) {
    return new Response("Not found", { status: 404 });
  }

  const limitUsd =
    parsed.data.mode === "limit" ? (parsed.data.monthlyLimitUsd ?? 0) : null;
  const row = setUserQuota(
    id,
    parsed.data.mode,
    limitUsd === null ? null : Math.round(limitUsd * NANO_USD_PER_USD),
  );
  return Response.json({
    quota: {
      userId: row.userId,
      mode: row.mode,
      monthlyLimitUsd:
        row.monthlyLimitNanoUsd === null
          ? null
          : row.monthlyLimitNanoUsd / NANO_USD_PER_USD,
    },
  });
}