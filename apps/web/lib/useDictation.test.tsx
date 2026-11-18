import { act, useLayoutEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { parseHTML } from "linkedom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useDictation, type Dictation } from "./useDictation";
import { dictationErrorMessage } from "./chat/message";

let root: Root;
let dictation: Dictation;
const result = vi.fn();
const releaseMicrophone = vi.fn();

class Recorder {
  static isTypeSupported() {
    return true;
  }
  state = "inactive";
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["recorded audio"]) });
    this.onstop?.();
  }
}
function Probe() {
  const current = useDictation(result);
  useLayoutEffect(() => { dictation = current; });
  return null;
}
beforeEach(async () => {
  vi.clearAllMocks();
  const { window } = parseHTML(
    '<html><body><div id="root"></div></body></html>',
  );
  vi.stubGlobal("window", window);
  vi.stubGlobal("document", window.document);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("MediaRecorder", Recorder);
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: vi.fn(async () => ({
        getTracks: () => [{ stop: releaseMicrophone }],
      })),
    },
  });
  root = createRoot(
    window.document.getElementById("root") as unknown as HTMLElement,
  );
  await act(async () => root.render(<Probe />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  vi.unstubAllGlobals();
});
async function record(response: Response) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response),
  );
  await act(async () => {
    await dictation.start();
  });
  await act(async () => {
    dictation.stop();
  });
}

it.each([
  [503, { error: "stt_unavailable", role: "admin" }, "暂时不可用"],
  [502, { code: "speech_unreachable" }, "无法连接"],
  [503, { code: "speech_disabled" }, "关闭"],
  [503, { code: "speech_not_configured" }, "尚未"],
  [401, { error: "Unauthorized" }, "请登录以继续"],
])(
  "renders HTTP %s according to explicit reason, not status alone",
  async (status, body, message) => {
    await record(Response.json(body, { status: status as number }));
    expect(dictation.status).toBe("idle");
    expect(releaseMicrophone).toHaveBeenCalledOnce();
    expect(result).not.toHaveBeenCalled();
    expect(dictation.error).not.toBeNull();
    expect(dictationErrorMessage(dictation.error!, true)).toContain(message);
    expect(dictationErrorMessage(dictation.error!, true)).not.toContain(
      "overtchat setup",
    );
    await act(async () => dictation.clearError());
    expect(dictation.error).toBeNull();
  },
);

it("does not display an HTML proxy error", async () => {
  await record(
    new Response("<html>Bad gateway: private endpoint</html>", { status: 502 }),
  );
  expect(dictationErrorMessage(dictation.error!, true)).toContain(
    "暂时不可用",
  );
});

it("distinguishes malformed success from an empty transcript", async () => {
  await record(Response.json({ text: 123 }));
  expect(dictation.error?.kind).toBe("other");
  expect(dictationErrorMessage(dictation.error!, true)).toContain(
    "无效响应",
  );
  await record(Response.json({ text: " " }));
  expect(dictation.error?.kind).toBe("empty");
});

it("clears a previous failure when recording again and returns only the successful transcript", async () => {
  await record(Response.json({ code: "speech_unreachable" }, { status: 502 }));
  await record(Response.json({ text: " recovered transcript " }));
  expect(dictation.error).toBeNull();
  expect(result).toHaveBeenCalledExactlyOnceWith("recovered transcript");
});
