import { describe, expect, it } from "vitest";
import {
  readTextVerbosity,
  setTextVerbosity,
} from "./response-style";

describe("text verbosity provider option", () => {
  it("reads a supported value and ignores everything else", () => {
    expect(readTextVerbosity('{"textVerbosity":"high"}')).toBe("high");
    expect(readTextVerbosity('{"textVerbosity":"low","store":false}')).toBe(
      "low",
    );
    expect(readTextVerbosity("")).toBeNull();
    expect(readTextVerbosity("{}")).toBeNull();
    expect(readTextVerbosity('{"textVerbosity":"max"}')).toBeNull();
    expect(readTextVerbosity('{"textVerbosity":1}')).toBeNull();
    expect(readTextVerbosity("not json")).toBeNull();
    expect(readTextVerbosity("[]")).toBeNull();
  });

  it("adds the key to empty or existing options", () => {
    expect(setTextVerbosity("", "high")).toEqual({
      text: '{\n  "textVerbosity": "high"\n}',
      error: null,
    });
    expect(setTextVerbosity('{"store":false}', "low")).toEqual({
      text: '{\n  "store": false,\n  "textVerbosity": "low"\n}',
      error: null,
    });
  });

  it("removes the key and collapses an empty object", () => {
    expect(setTextVerbosity('{"textVerbosity":"high"}', null)).toEqual({
      text: "",
      error: null,
    });
    expect(setTextVerbosity('{"textVerbosity":"high","store":false}', null))
      .toEqual({
        text: '{\n  "store": false\n}',
        error: null,
      });
  });

  it("refuses to rewrite invalid JSON or non-object options", () => {
    const invalid = setTextVerbosity('{"store":', "high");
    expect(invalid.text).toBe('{"store":');
    expect(invalid.error).toBeTruthy();

    const array = setTextVerbosity("[]", "high");
    expect(array.text).toBe("[]");
    expect(array.error).toBe("Provider options must be a JSON object");
  });
});
