import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router";
import { expect, it, vi } from "vitest";
import type { useSpeech } from "@/lib/useSpeech";
import { MiniSpeechPlayer } from "@/components/chat/MiniSpeechPlayer";

function idleSpeech(): ReturnType<typeof useSpeech> {
  return {
    activeId: null,
    status: "idle",
    canSeek: false,
    error: null,
    canRetry: true,
    play: vi.fn(),
    stop: vi.fn(),
    retry: vi.fn(),
    audioRef: { current: null },
  };
}

const router = createRouter({
  routeTree: createRootRoute(),
  history: createMemoryHistory(),
});

function render(element: ReactElement): string {
  return renderToStaticMarkup(
    <RouterContextProvider router={router}>{element}</RouterContextProvider>,
  );
}

it("keeps idle player markup independent of session hydration", () => {
  const speech = idleSpeech();
  const anonymous = render(<MiniSpeechPlayer speech={speech} />);
  const admin = render(<MiniSpeechPlayer speech={speech} isAdmin />);
  expect(admin).toBe(anonymous);
  expect(admin).not.toContain('role="alert"');
  expect(admin).not.toContain("语音设置");
  // The media element stays mounted for synchronous playback on mobile.
  expect(admin).toContain('<audio slot="media" tabindex="-1">');
});

it("shows recovery and admin settings when playback actually fails", () => {
  const speech = { ...idleSpeech(), error: "Couldn't reach the speech playback service." };
  const markup = render(<MiniSpeechPlayer speech={speech} isAdmin />);
  expect(markup).toContain('role="alert"');
  expect(markup).toContain("重试播放");
  expect(markup).toContain("语音设置");
});
