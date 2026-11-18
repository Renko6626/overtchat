/** Public, transport-neutral error information shared by web and native clients. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type SpeechService = "stt" | "tts";
export type SpeechErrorCode =
  | "speech_disabled"
  | "speech_not_configured"
  | "speech_unreachable"
  | "speech_timeout"
  | "speech_provider_auth"
  | "speech_rate_limited"
  | "speech_provider_error"
  | "speech_invalid_response";

export function isSpeechErrorCode(code: unknown): code is SpeechErrorCode {
  return (
    typeof code === "string" &&
    [
      "speech_disabled",
      "speech_not_configured",
      "speech_unreachable",
      "speech_timeout",
      "speech_provider_auth",
      "speech_rate_limited",
      "speech_provider_error",
      "speech_invalid_response",
    ].includes(code)
  );
}

export function speechErrorMessage(
  service: SpeechService,
  code?: string,
): string {
  const feature = service === "stt" ? "语音输入" : "朗读";
  const provider = service === "stt" ? "转写服务" : "语音播放服务";
  switch (code) {
    case "speech_disabled":
      return `${feature}已在本服务器关闭。`;
    case "speech_not_configured":
      return `${feature}尚未在本服务器配置。`;
    case "speech_unreachable":
      return `无法连接${provider}，请稍后重试。`;
    case "speech_timeout":
      return `${provider}响应超时，请重试。`;
    case "speech_provider_auth":
      return `${provider}拒绝了服务器的凭据，请联系管理员检查语音设置。`;
    case "speech_rate_limited":
      return `${provider}正忙，请稍后重试。`;
    case "speech_invalid_response":
      return `${provider}返回了无效响应，请重试。`;
    default:
      return `${provider}暂时不可用，请稍后重试。`;
  }
}

/** Only normalized API errors carry a message intended for display. */
export function getErrorMessage(
  error: unknown,
  fallback = "出了点问题，请重试。",
): string {
  return error instanceof ApiError ? error.message : fallback;
}

/** Accepts decoded JSON or legacy text. HTTP status alone never implies missing setup. */
export function apiError(
  status: number,
  body: unknown,
  fallback: string,
  service?: SpeechService,
): ApiError {
  let decoded = body;
  if (typeof body === "string") {
    try {
      decoded = JSON.parse(body);
    } catch {
      /* Legacy plain-text response. */
    }
  }
  const code =
    decoded &&
    typeof decoded === "object" &&
    "code" in decoded &&
    typeof decoded.code === "string"
      ? decoded.code
      : undefined;
  let message: string;
  if (service && isSpeechErrorCode(code))
    message = speechErrorMessage(service, code);
  else if (status === 401) message = "请登录以继续。";
  else if (status === 403) message = "您没有权限执行此操作。";
  else if (status === 429) message = "请求过于频繁，请稍后重试。";
  else if (service && status >= 500)
    message = speechErrorMessage(
      service,
      status === 504 ? "speech_timeout" : undefined,
    );
  // OvertChat's API error field is public display copy. Do not unwrap nested
  // provider payloads, interpret message text, or display unknown coded errors.
  else if (
    !code &&
    decoded &&
    typeof decoded === "object" &&
    "error" in decoded &&
    typeof decoded.error === "string"
  ) message = decoded.error;
  else message = fallback;
  return new ApiError(message, status, code);
}
