import "server-only";

const DEFAULT_REPLY_LANGUAGE = "Simplified Chinese (简体中文)";

export function replyLanguageSystemPrompt(): string | null {
  const language = (
    process.env.OVERTCHAT_REPLY_LANGUAGE ?? DEFAULT_REPLY_LANGUAGE
  ).trim();
  if (!language || language.toLowerCase() === "off") return null;
  return `Reply in ${language} by default, unless the user explicitly requests another language.`;
}