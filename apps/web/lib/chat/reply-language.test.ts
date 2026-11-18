import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { replyLanguageSystemPrompt } from "./reply-language";

describe("reply language directive", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to Simplified Chinese", () => {
    expect(replyLanguageSystemPrompt()).toContain("Simplified Chinese");
  });

  it("honors a configured language", () => {
    vi.stubEnv("OVERTCHAT_REPLY_LANGUAGE", "English");
    expect(replyLanguageSystemPrompt()).toBe(
      "Reply in English by default, unless the user explicitly requests another language.",
    );
  });

  it("can be disabled", () => {
    vi.stubEnv("OVERTCHAT_REPLY_LANGUAGE", "off");
    expect(replyLanguageSystemPrompt()).toBeNull();
    vi.stubEnv("OVERTCHAT_REPLY_LANGUAGE", "  ");
    expect(replyLanguageSystemPrompt()).toBeNull();
  });
});