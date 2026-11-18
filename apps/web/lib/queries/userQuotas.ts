"use client";

import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiUrl } from "@/lib/api-url";
import { quotaKeys } from "@/lib/queries/keys";

export type QuotaMode = "inherit" | "unlimited" | "limit";

export interface QuotaOverride {
  userId: string;
  mode: QuotaMode;
  monthlyLimitUsd: number | null;
}

export interface QuotaOverview {
  defaultMonthlyLimitUsd: number | null;
  overrides: QuotaOverride[];
  monthlyCostsUsd: Record<string, number>;
}

export const quotaOverviewQuery = queryOptions({
  queryKey: quotaKeys.detail(),
  queryFn: async (): Promise<QuotaOverview> => {
    const response = await fetch(apiUrl("/api/users/quotas"));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as QuotaOverview;
  },
});

export function useQuotaOverview() {
  return useQuery(quotaOverviewQuery);
}

async function errorFrom(response: Response): Promise<Error> {
  const data = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  return new Error(data?.error ?? `HTTP ${response.status}`);
}

export function useSetDefaultQuota() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (defaultMonthlyLimitUsd: number | null) => {
      const response = await fetch(apiUrl("/api/users/quotas"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultMonthlyLimitUsd }),
      });
      if (!response.ok) throw await errorFrom(response);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: quotaKeys.all() }),
  });
}

export function useSetUserQuota() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      mode,
      monthlyLimitUsd,
    }: {
      userId: string;
      mode: QuotaMode;
      monthlyLimitUsd?: number | null;
    }) => {
      const response = await fetch(apiUrl(`/api/users/${userId}/quota`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, monthlyLimitUsd }),
      });
      if (!response.ok) throw await errorFrom(response);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: quotaKeys.all() }),
  });
}