import "server-only";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { generationUsage, quotaSettings, userQuotas } from "@/lib/db/schema";

export const NANO_USD_PER_USD = 1_000_000_000;

export type QuotaMode = "inherit" | "unlimited" | "limit";

export type UserQuotaRow = typeof userQuotas.$inferSelect;

export interface QuotaStatus {
  limitNanoUsd: number | null;
  spentNanoUsd: number;
  exceeded: boolean;
}

export function monthRange(now: Date): { from: Date; to: Date } {
  return {
    from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    to: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
  };
}

export function getDefaultMonthlyLimitNanoUsd(): number | null {
  const row = db
    .select()
    .from(quotaSettings)
    .where(eq(quotaSettings.id, 1))
    .get();
  return row?.defaultMonthlyLimitNanoUsd ?? null;
}

export function setDefaultMonthlyLimitNanoUsd(
  limitNanoUsd: number | null,
): void {
  const updatedAt = new Date();
  db.insert(quotaSettings)
    .values({ id: 1, defaultMonthlyLimitNanoUsd: limitNanoUsd, updatedAt })
    .onConflictDoUpdate({
      target: quotaSettings.id,
      set: { defaultMonthlyLimitNanoUsd: limitNanoUsd, updatedAt },
    })
    .run();
}

export function getUserQuota(userId: string): UserQuotaRow | null {
  return (
    db.select().from(userQuotas).where(eq(userQuotas.userId, userId)).get() ??
    null
  );
}

export function listUserQuotas(): UserQuotaRow[] {
  return db.select().from(userQuotas).all();
}

export function setUserQuota(
  userId: string,
  mode: QuotaMode,
  monthlyLimitNanoUsd: number | null,
): UserQuotaRow {
  const updatedAt = new Date();
  const limit = mode === "limit" ? monthlyLimitNanoUsd : null;
  db.insert(userQuotas)
    .values({ userId, mode, monthlyLimitNanoUsd: limit, updatedAt })
    .onConflictDoUpdate({
      target: userQuotas.userId,
      set: { mode, monthlyLimitNanoUsd: limit, updatedAt },
    })
    .run();
  return getUserQuota(userId)!;
}

export function effectiveMonthlyLimitNanoUsd(userId: string): number | null {
  const override = getUserQuota(userId);
  if (override?.mode === "unlimited") return null;
  if (override?.mode === "limit") return override.monthlyLimitNanoUsd ?? 0;
  return getDefaultMonthlyLimitNanoUsd();
}

// Quotas count every billed generation (chat, titles, images) except those
// run on the user's own API key, unlike the Activity totals which only cover
// the chat context.
const monthlyCostTotal = sql<number>`coalesce(sum(${generationUsage.totalCostNanoUsd}), 0)`;

export function getMonthlyCostNanoUsd(
  userId: string,
  now: Date = new Date(),
): number {
  const { from, to } = monthRange(now);
  const [row] = db
    .select({ total: monthlyCostTotal })
    .from(generationUsage)
    .where(
      and(
        eq(generationUsage.userId, userId),
        eq(generationUsage.ownKey, false),
        gte(generationUsage.occurredAt, from),
        lt(generationUsage.occurredAt, to),
      ),
    )
    .all();
  return row?.total ?? 0;
}

export function listMonthlyCostsNanoUsd(
  now: Date = new Date(),
): Map<string, number> {
  const { from, to } = monthRange(now);
  const rows = db
    .select({ userId: generationUsage.userId, total: monthlyCostTotal })
    .from(generationUsage)
    .where(
      and(
        eq(generationUsage.ownKey, false),
        gte(generationUsage.occurredAt, from),
        lt(generationUsage.occurredAt, to),
      ),
    )
    .groupBy(generationUsage.userId)
    .all();
  return new Map(rows.map((row) => [row.userId, row.total]));
}

export function checkUserQuota(
  userId: string,
  now: Date = new Date(),
): QuotaStatus {
  const limitNanoUsd = effectiveMonthlyLimitNanoUsd(userId);
  if (limitNanoUsd === null) {
    return { limitNanoUsd: null, spentNanoUsd: 0, exceeded: false };
  }
  const spentNanoUsd = getMonthlyCostNanoUsd(userId, now);
  return { limitNanoUsd, spentNanoUsd, exceeded: spentNanoUsd >= limitNanoUsd };
}