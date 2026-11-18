import { ApiError, speechErrorMessage, readableMessageText } from "@overtchat/shared";
import { remark } from "remark";
import strip from "strip-markdown";
import type { UIMessage } from "ai";
import type { DictationError } from "@/lib/useDictation";
import { stripCitationMarkers } from "@/lib/citations";

const stripper = remark().use(strip);

export function stripMarkdown(s: string): string {
  return String(stripper.processSync(s)).replace(/\s+/g, " ").trim();
}

export function textOf(message: UIMessage): string {
  return readableMessageText(message);
}

export function speakableText(message: UIMessage): string {
  return stripMarkdown(stripCitationMarkers(readableMessageText(message)));
}

export function dictationErrorMessage(
  err: DictationError,
  isAdmin: boolean,
): string {
  switch (err.kind) {
    case "permission":
      return "麦克风权限被拒绝。请在浏览器设置中允许麦克风后使用语音输入。";
    case "insecure_context":
      return "此地址需要 HTTPS 才能使用麦克风。请通过 HTTPS 打开 OvertChat，或在运行服务器的电脑上使用 localhost 访问。";
    case "unsupported":
      return "当前浏览器不支持录音。";
    case "stt_unavailable":
      return speechErrorMessage("stt", err.code) +
        (!isAdmin && (err.code === "speech_disabled" || err.code === "speech_not_configured")
          ? "请联系管理员启用。" : "");
    case "empty":
      return "未检测到语音，请重试。";
    case "other":
      return err.message;
  }
}

const CHAT_ERROR_FALLBACK = "未能完成回复，请重试。";
const CHAT_ERROR_MAX_LENGTH = 300;

/**
 * Failed responses carry the server's own text: provider errors arrive through
 * the stream's error part and route failures as the response body. Transport
 * failures (fetch rejects with a TypeError) and empty messages keep the generic
 * copy.
 */
export function chatErrorMessage(error: Error): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError) return CHAT_ERROR_FALLBACK;
  const message = error.message.trim();
  if (!message) return CHAT_ERROR_FALLBACK;
  return message.length > CHAT_ERROR_MAX_LENGTH
    ? `${message.slice(0, CHAT_ERROR_MAX_LENGTH - 1)}…`
    : message;
}
