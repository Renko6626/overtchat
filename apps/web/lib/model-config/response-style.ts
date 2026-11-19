/**
 * Helpers for the OpenAI Responses API `text.verbosity` option, which the
 * settings UI stores as `textVerbosity` inside the model's provider options.
 */

export const TEXT_VERBOSITY_KEY = "textVerbosity";

export const TEXT_VERBOSITY_VALUES = ["low", "medium", "high"] as const;

export type TextVerbosity = (typeof TEXT_VERBOSITY_VALUES)[number];

export function isTextVerbosity(value: unknown): value is TextVerbosity {
  return (
    typeof value === "string" &&
    (TEXT_VERBOSITY_VALUES as readonly string[]).includes(value)
  );
}

/** Read the configured verbosity, ignoring malformed or unsupported values. */
export function readTextVerbosity(optionsText: string): TextVerbosity | null {
  if (!optionsText.trim()) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(optionsText);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }
  const value = (parsed as Record<string, unknown>)[TEXT_VERBOSITY_KEY];
  return isTextVerbosity(value) ? value : null;
}

/**
 * Write or remove `textVerbosity` without disturbing the rest of the options.
 * Passing null removes the key; an empty object collapses back to an empty
 * editor so the request keeps provider defaults.
 */
export function setTextVerbosity(
  optionsText: string,
  value: TextVerbosity | null,
): { text: string; error: string | null } {
  let parsed: Record<string, unknown> = {};
  if (optionsText.trim()) {
    let candidate: unknown;
    try {
      candidate = JSON.parse(optionsText);
    } catch (error) {
      return {
        text: optionsText,
        error: error instanceof Error ? error.message : String(error),
      };
    }
    if (
      typeof candidate !== "object" ||
      candidate === null ||
      Array.isArray(candidate)
    ) {
      return {
        text: optionsText,
        error: "Provider options must be a JSON object",
      };
    }
    parsed = candidate as Record<string, unknown>;
  }

  if (value === null) {
    delete parsed[TEXT_VERBOSITY_KEY];
  } else {
    parsed[TEXT_VERBOSITY_KEY] = value;
  }

  return {
    text:
      Object.keys(parsed).length > 0
        ? JSON.stringify(parsed, null, 2)
        : "",
    error: null,
  };
}
