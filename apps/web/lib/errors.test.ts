import { describe, expect, it } from "vitest";
import { apiError, getErrorMessage } from "@overtchat/shared";

describe("public error messages", () => {
  it("displays messages explicitly normalized at the API boundary", () => {
    const error = apiError(503, { code: "speech_unreachable" }, "Failed", "stt");
    expect(getErrorMessage(error)).toBe("无法连接转写服务，请稍后重试。");
  });

  it.each([
    new Error("unauthorized"),
    new TypeError("Failed to fetch"),
    { message: "Choose a model first." },
    '{"error":{"message":"Choose a model first."}}',
    "<!DOCTYPE html><html>Bad gateway</html>",
    "stt_unavailable",
    "connect ECONNREFUSED 127.0.0.1:9999",
    "x".repeat(501),
  ])("uses the operation fallback for an unclassified failure: %s", (error) => {
    expect(getErrorMessage(error, "Couldn't save changes.")).toBe("Couldn't save changes.");
  });

  it("does not interpret arbitrary response text or unknown error codes", () => {
    for (const body of ["unauthorized", { error: { message: "forbidden" } }, { code: "new_provider_error", error: "Check your connection" }]) {
      expect(apiError(502, body, "Couldn't finish.").message).toBe("Couldn't finish.");
    }
  });

  it("preserves the API's explicit public error field without interpreting it", () => {
    expect(apiError(400, { error: "Choose a model first." }, "Failed").message)
      .toBe("Choose a model first.");
    expect(apiError(502, { error: "unauthorized" }, "Failed").message)
      .toBe("unauthorized");
  });

  it("does not blame the user's connection for a provider fetch error", () => {
    expect(apiError(502, "fetch failed", "The provider could not complete the request.").message)
      .toBe("The provider could not complete the request.");
  });

  it.each([401, 403, 429])(
    "gives actionable feedback for HTTP %s",
    (status) => {
      const error = apiError(status, "<html>proxy error</html>", "Failed");
      expect(error.status).toBe(status);
      expect(error.message).not.toBe("Failed");
      expect(error.message).not.toContain("<html>");
    },
  );

  it("does not infer missing setup from legacy speech 503s", () => {
    for (const body of [
      { error: "stt_unavailable", role: "admin" },
      "Service unavailable",
      "<html>503</html>",
    ]) {
      const error = apiError(503, body, "Failed", "stt");
      expect(error.message).toContain("暂时不可用");
      expect(error.message).not.toMatch(/配置|关闭/);
    }
  });

  it("uses explicit speech reasons and distinguishes upstream credentials from viewer authentication", () => {
    expect(
      apiError(503, { code: "speech_disabled" }, "Failed", "stt").message,
    ).toContain("关闭");
    expect(
      apiError(503, { code: "speech_not_configured" }, "Failed", "stt").message,
    ).toContain("尚未");
    expect(
      apiError(502, { code: "speech_provider_auth" }, "Failed", "tts").message,
    ).toContain("凭据");
    expect(apiError(401, "Unauthorized", "Failed", "tts").message).toContain(
      "请登录",
    );
  });
});
