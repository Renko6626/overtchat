import "server-only";
import { z } from "zod";
import type { WebSearchOutput } from "@overtchat/shared";

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const MAX_QUERY_CHARS = 128;

const searchResponseSchema = z.object({
  results: z
    .array(
      z.object({
        title: z.string().optional(),
        url: z.string(),
        snippet: z.string().optional(),
        summary: z.string().optional(),
        date: z.string().nullable().optional(),
      }),
    )
    .default([]),
});

const errorResponseSchema = z.object({
  error: z.object({ message: z.string() }).nullish(),
});

export interface DeepSeekSearchConfiguration {
  apiKey: string;
  baseUrl?: string | null;
}

export async function deepSeekSearchWeb(
  query: string,
  limit: number,
  configuration: DeepSeekSearchConfiguration,
  signal?: AbortSignal,
): Promise<WebSearchOutput> {
  const trimmed = Array.from(query.trim()).slice(0, MAX_QUERY_CHARS).join("");
  if (!trimmed) {
    throw new Error("DeepSeek search requires a non-empty query.");
  }
  const baseUrl = (configuration.baseUrl?.trim() || DEFAULT_BASE_URL).replace(
    /\/+$/u,
    "",
  );
  // Admin-configured endpoint, same trust level as the SearXNG URL, but keep
  // the key off plaintext links: https only, except loopback dev proxies.
  const parsedBase = new URL(baseUrl);
  if (
    parsedBase.protocol !== "https:" &&
    !["localhost", "127.0.0.1", "::1"].includes(parsedBase.hostname)
  ) {
    throw new Error("The DeepSeek search base URL must use https.");
  }
  const response = await fetch(`${baseUrl}/v1/tools/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${configuration.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: trimmed, count: limit }),
    signal,
  });
  if (!response.ok) {
    const parsed = errorResponseSchema.safeParse(
      await response.json().catch(() => null),
    );
    const message = parsed.success ? parsed.data.error?.message : undefined;
    throw new Error(
      `DeepSeek search failed (${response.status})${message ? `: ${message}` : ""}`,
    );
  }
  const body: unknown = await response.json().catch(() => null);
  const parsed = searchResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error("DeepSeek search returned an unexpected response.");
  }
  const results = parsed.data.results.slice(0, limit);
  return {
    provider: "deepseek",
    sources: results.map((result) => ({
      title: result.title || result.url,
      url: result.url,
      snippet: result.summary || result.snippet || "",
      ...(result.date ? { publishedDate: result.date } : {}),
    })),
    searchQueries: [trimmed],
    usage: { searchRequests: results.length > 0 ? 1 : 0 },
  };
}