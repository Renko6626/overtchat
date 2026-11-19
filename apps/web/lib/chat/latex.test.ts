import { describe, expect, it } from "vitest";
import { normalizeLatexDelimiters } from "./latex";

describe("normalizeLatexDelimiters", () => {
  it("rewrites KaTeX delimiters into remark-math delimiters", () => {
    expect(normalizeLatexDelimiters("这里的 \\(X^\\mu\\) 是坐标。")).toBe(
      "这里的 $X^\\mu$ 是坐标。",
    );
    expect(normalizeLatexDelimiters("\\[ S_P = \\frac{1}{2} \\]")).toBe(
      "$$ S_P = \\frac{1}{2} $$",
    );
  });

  it("handles multiple and multi-line formulas", () => {
    const input = "\\(a\\) 和 \\(b\\)\n\n\\[\n\\frac{1}{2}\n\\]";
    expect(normalizeLatexDelimiters(input)).toBe(
      "$a$ 和 $b$\n\n$$\n\\frac{1}{2}\n$$",
    );
  });

  it("leaves fenced code, inline code, and escaped delimiters alone", () => {
    const input = [
      "```latex",
      "\\[ x \\]",
      "```",
      "",
      "`\\(y\\)` 与 \\\\(z\\\\)",
    ].join("\n");
    expect(normalizeLatexDelimiters(input)).toBe(input);
  });

  it("leaves unterminated or already-delimited math alone", () => {
    expect(normalizeLatexDelimiters("broken \\(x")).toBe("broken \\(x");
    expect(normalizeLatexDelimiters("$x$ and $$y$$")).toBe("$x$ and $$y$$");
  });

  it("does not wrap bodies that contain a bare dollar sign", () => {
    expect(normalizeLatexDelimiters("\\(a $ b\\)")).toBe("\\(a $ b\\)");
  });
});
